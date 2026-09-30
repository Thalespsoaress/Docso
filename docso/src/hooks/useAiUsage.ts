import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

type Contador = { used: number; limit: number }
type AiUsage = { mapeamentos: Contador; chamadas: Contador; resetAt: string }

export function aiErrorCode(err: unknown) {
  return (err as { body?: { code?: string } }).body?.code
}

export function isAiLimitError(err: unknown) {
  return aiErrorCode(err) === 'AI_LIMIT_REACHED'
}

export function useAiUsage() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => api.get<AiUsage>('/api/ai/usage'),
  })

  const renovaEm = data
    ? new Date(data.resetAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
    : ''
  const esgotou = (c?: Contador) => !!c && c.used >= c.limit

  return {
    usage: data,
    mapeamentosEsgotados: esgotou(data?.mapeamentos),
    chamadasEsgotadas: esgotou(data?.chamadas),
    quase: !!data && data.mapeamentos.used >= data.mapeamentos.limit * 0.8,
    mensagemMapeamentos: data
      ? `Você usou os ${data.mapeamentos.limit} mapeamentos deste mês. O limite renova em ${renovaEm}.`
      : 'Os mapeamentos deste mês acabaram.',
    mensagemChamadas: data
      ? `O uso de IA deste mês acabou. O limite renova em ${renovaEm}.`
      : 'O uso de IA deste mês acabou.',
    refresh: () => queryClient.invalidateQueries({ queryKey: ['ai-usage'] }),
  }
}
