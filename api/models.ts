import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  try {
    const res = await axios.get("https://openrouter.ai/api/v1/models");
    return response.status(200).json(res.data);
  } catch (error: any) {
    console.error("Error fetching models:", error.message);
    return response.status(500).json({ error: "Failed to fetch models" });
  }
}
