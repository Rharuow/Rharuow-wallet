export function isOpenAiMockEnabled() {
  return process.env.OPENAI_MOCK_MODE === 'true'
}
