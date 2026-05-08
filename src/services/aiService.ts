
export interface AIRequest {
  model?: string;
  contents: any;
  config?: any;
}

export const generateAIContent = async (request: AIRequest): Promise<{ text: string }> => {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate AI content');
  }

  return response.json();
};
