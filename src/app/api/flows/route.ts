import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { buildTemplateWithOverrides } from '@/lib/flows/templates'
import { validateFlowForActivation } from '@/lib/flows/validate'

/**
 * GET /api/flows — list the caller's flows.
 * POST /api/flows — create a new (draft) flow.
 *
 * Available to every authenticated user. The previous per-account
 * beta gate was removed when Flows went to soft-GA; the UI still
 * shows a "Beta" label so users know the surface is young, but the
 * routes themselves are open.
 */

async function requireUser(): Promise<
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: number; body: { error: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } }
  }
  return { ok: true, userId: user.id, supabase }
}

export async function GET() {
  const guard = await requireUser()
  if (!guard.ok) {
    return NextResponse.json(guard.body, { status: guard.status })
  }
  const { supabase } = guard

  const { data, error } = await supabase
    .from('flows')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ flows: data ?? [] })
}

export async function POST(request: Request) {
  // Creating a flow is a write — the RLS flows_insert policy requires
  // `agent`, but this route inserts via the service-role client which
  // bypasses RLS, so the role must be enforced here.
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const guard = await requireUser()
  if (!guard.ok) {
    return NextResponse.json(guard.body, { status: guard.status })
  }
  const { userId, supabase } = guard

  // Resolve the caller's account_id — `flows.account_id` is NOT NULL
  // post-017, so an INSERT without it trips the not-null constraint
  // even though the admin client below bypasses RLS.
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .single()
  const accountId = profile?.account_id as string | undefined
  if (!accountId) {
    return NextResponse.json(
      { error: 'Your profile is not linked to an account.' },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        description?: string | null
        trigger_type?: 'keyword' | 'first_inbound_message' | 'manual'
        trigger_config?: Record<string, unknown>
        trigger_keywords?: string[] | null
        initial_message?: string | null
        button_options?: string[] | null
        /** Clone the matching template graph and apply validated CSV overrides. */
        template_slug?: string
      }
    | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const triggerTypes = ['keyword', 'first_inbound_message', 'manual'] as const
  const trigger_type = body.trigger_type ?? 'keyword'
  if (!body.template_slug && (typeof body.name !== 'string' || !body.name.trim())) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
  }
  if (body.trigger_type !== undefined && !triggerTypes.includes(body.trigger_type)) {
    return NextResponse.json({ error: `Unsupported trigger_type "${body.trigger_type}"` }, { status: 400 })
  }
  if (body.template_slug !== undefined && typeof body.template_slug !== 'string') {
    return NextResponse.json({ error: 'template_slug must be a string' }, { status: 400 })
  }
  if (body.description != null && typeof body.description !== 'string') {
    return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 })
  }
  if (body.initial_message != null && typeof body.initial_message !== 'string') {
    return NextResponse.json({ error: 'initial_message must be a string or null' }, { status: 400 })
  }
  if (body.trigger_keywords != null && (
    !Array.isArray(body.trigger_keywords) ||
    body.trigger_keywords.length === 0 ||
    body.trigger_keywords.some((keyword) => typeof keyword !== 'string' || !keyword.trim())
  )) {
    return NextResponse.json({ error: 'trigger_keywords must contain non-empty strings' }, { status: 400 })
  }
  if (body.button_options != null && (
    !Array.isArray(body.button_options) ||
    body.button_options.length < 1 ||
    body.button_options.length > 3 ||
    body.button_options.some((label) => typeof label !== 'string' || !label.trim() || label.length > 20)
  )) {
    return NextResponse.json({ error: 'button_options must contain 1 to 3 non-empty labels, each no longer than 20 characters' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // -------- Template clone path --------
  if (body.template_slug !== undefined) {
    let template: ReturnType<typeof buildTemplateWithOverrides>
    try {
      template = buildTemplateWithOverrides(body.template_slug, {
        name: body.name,
        description: body.description,
        trigger_type: body.trigger_type,
        trigger_keywords: body.trigger_keywords ?? undefined,
        initial_message: body.initial_message ?? undefined,
        button_options: body.button_options ?? undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Template override is invalid.'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (!template) {
      return NextResponse.json(
        { error: `Unknown template_slug "${body.template_slug}"` },
        { status: 400 },
      )
    }

    const issues = validateFlowForActivation(
      {
        name: template.name,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_config as Record<string, unknown>,
        entry_node_id: template.entry_node_id,
      },
      template.nodes as Array<{
        node_key: string;
        node_type: string;
        config: Record<string, unknown>;
      }>,
    )
    const blockers = issues.filter((i) => i.severity === 'error')
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: `Template graph validation failed: ${blockers.map((b) => b.message).join('; ')}`,
          issues,
        },
        { status: 400 },
      )
    }

    const { data: flow, error: flowErr } = await admin
      .from('flows')
      .insert({
        user_id: userId,
        account_id: accountId,
        name: template.name,
        description: body.description ?? template.description,
        status: 'draft',
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_config,
        entry_node_id: template.entry_node_id,
      })
      .select()
      .single()
    if (flowErr || !flow) {
      return NextResponse.json({ error: flowErr?.message ?? 'flow insert failed' }, { status: 500 })
    }

    if (template.nodes.length > 0) {
      const { error: nodesErr } = await admin.from('flow_nodes').insert(
        template.nodes.map((node) => ({
          flow_id: flow.id,
          node_key: node.node_key,
          node_type: node.node_type,
          config: node.config,
        })),
      )
      if (nodesErr) {
        await admin.from('flows').delete().eq('id', flow.id)
        return NextResponse.json({ error: nodesErr.message }, { status: 500 })
      }
    }
    return NextResponse.json({ flow }, { status: 201 })
  }

  // -------- Plain (empty) create path --------
  const trigger_config = body.trigger_keywords
    ? { keywords: body.trigger_keywords, match_type: 'contains' }
    : body.trigger_config ?? {}
  if (trigger_type === 'keyword') {
    const keywords = (trigger_config as { keywords?: unknown }).keywords
    if (!Array.isArray(keywords) || keywords.length === 0 || keywords.some((keyword) => typeof keyword !== 'string' || !keyword.trim())) {
      return NextResponse.json({ error: 'keyword trigger requires at least one non-empty keyword' }, { status: 400 })
    }
  }

  // In the non-template path, `body.name` is guaranteed to be a non-empty string by the guard above.
  const flowName = body.name!.trim()

  const { data, error } = await admin
    .from('flows')
    .insert({
      user_id: userId,
      account_id: accountId,
      name: flowName,
      description: body.description ?? null,
      status: 'draft',
      trigger_type,
      trigger_config,
    })
    .select()
    .single()
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  }
  return NextResponse.json({ flow: data }, { status: 201 })
}
