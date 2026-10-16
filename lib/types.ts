export type Profile = {
  id: string
  display_name: string
  badges: string[]
  suspended: boolean
  created_at: string
}

export type GdIdentity = {
  id: string
  user_id: string
  gd_player_id: number
  gd_player_name: string
  verification_token: string
  verification_status: 'pending' | 'verified' | 'rejected'
  created_at: string
  updated_at: string
}

export type Level = {
  id: string
  name: string
  gd_level_id: number
  difficulty: string
  points: number
  published: boolean
  created_at: string
}

export type LevelProposal = {
  id: string
  proposed_by: string
  name: string
  gd_level_id: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export type Record = {
  id: string
  player_id: string
  level_id: string | null
  level_proposal_id: string | null
  progress: number
  evidence_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewer_id: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
}

export type PublicRecord = {
  id: string
  player_id: string
  level_id: string
  progress: number
  evidence_url: string | null
  created_at: string
  profiles?: { display_name: string }
  levels?: { name: string; points: number }
}

export type SiteContent = {
  key: string
  value: string
  published: boolean
  updated_at: string
}

export type SiteSetting = {
  key: string
  value: string
  updated_at: string
}

export type Announcement = {
  id: string
  title: string
  body: string
  published: boolean
  published_at: string | null
  sort_order: number
  created_at: string
}

export type AuditLogEntry = {
  id: string
  actor_id: string
  action: string
  entity: string
  entity_id: string | null
  changes: Record<string, unknown> | null
  created_at: string
}

export type AdminRecord = Record & {
  profiles?: { display_name: string }
  levels?: { name: string; points: number }
}
