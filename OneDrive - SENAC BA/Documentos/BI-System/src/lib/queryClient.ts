import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Manter em cache por 30 minutos
      gcTime: 30 * 60 * 1000,
      // Retry apenas 1 vez em caso de erro
      retry: 1,
      // Não refetch ao focar a janela (evita requests desnecessários)
      refetchOnWindowFocus: false,
      // Stale-while-revalidate: mostra dados em cache enquanto busca novos
      refetchOnMount: 'always',
    },
  },
});
