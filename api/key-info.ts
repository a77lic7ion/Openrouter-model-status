import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const apiKey = request.headers["x-openrouter-key"] || process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return response.status(401).json({ error: "OpenRouter API Key is required." });
  }

  try {
    const res = await axios.get("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return response.status(200).json(res.data);
  } catch (error: any) {
    console.error("Error fetching key info:", error.message);
    return response.status(error.response?.status || 500).json({ 
      error: error.response?.data || "Failed to fetch key info" 
    });
  }
}
