export type TrainingStatus = 'pending' | 'in_progress' | 'completed'

export type Assignment = {
  id: string
  status: TrainingStatus
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  assignee: { id: string; name: string; email: string }
  process: { id: string; title: string }
}

export const TRAINING_STATUS: Record<TrainingStatus, { label: string; className: string }> = {
  pending: { label: 'Não iniciado', className: 'status-pendente' },
  in_progress: { label: 'Em andamento', className: 'status-andamento' },
  completed: { label: 'Concluído', className: 'status-concluido' },
}

const PARADO_DIAS = 7

function haDias(n: number) {
  return n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`
}

export function andamento(a: Assignment) {
  if (a.status === 'completed' && a.completedAt) {
    return { texto: `Concluído em ${new Date(a.completedAt).toLocaleDateString('pt-BR')}`, parado: false }
  }
  const desde = a.status === 'in_progress' && a.startedAt ? a.startedAt : a.createdAt
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000)
  return {
    texto: `${a.status === 'in_progress' ? 'Iniciado' : 'Enviado'} ${haDias(dias)}`,
    parado: dias >= PARADO_DIAS,
  }
}
