// Sistema de eventos para sincronização global após importações

type ImportEventCallback = () => void;

class ImportEventEmitter {
  private listeners: ImportEventCallback[] = [];

  // Registra um callback para ser executado quando uma importação é concluída
  subscribe(callback: ImportEventCallback): () => void {
    this.listeners.push(callback);
    
    // Retorna função de unsubscribe
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Dispara evento de importação concluída
  emit(): void {
    console.log(`[ImportEvents] Emitindo evento de importação concluída para ${this.listeners.length} listeners`);
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[ImportEvents] Erro ao executar callback:', error);
      }
    });
  }
}

// Singleton global para ser usado em toda a aplicação
export const importEvents = new ImportEventEmitter();
