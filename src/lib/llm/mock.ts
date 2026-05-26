export async function runPromptMock(prompt: string) {
  return {
    rawText: `Respuesta simulada para: ${prompt}`,
    model: "mock/model",
    inputTokens: null,
    outputTokens: null,
  };
}
