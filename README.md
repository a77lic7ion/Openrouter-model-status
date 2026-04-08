# 🚀 OpenRouter Model Monitor

A high-performance, real-time dashboard for monitoring OpenRouter AI models. This application provides deep insights into model availability, latency, usage metrics, and pricing, helping developers choose the best model for their needs at any given moment.

![OpenRouter Monitor](https://picsum.photos/seed/openrouter/1200/600)

## ✨ Features

- **Real-Time Monitoring**: Live updates of model status, latency, and current load.
- **Quick Pick Recommendations**: Automatically identifies the top 3 available models optimized for speed and reliability.
- **Favorites System**: Star your most-used models for instant access in a dedicated section.
- **Health-Based Visuals**: 
  - 🟢 **Green**: Healthy (Low latency, low usage).
  - 🟠 **Orange**: Moderate (Medium latency or load).
  - 🔴 **Red**: Critical (High latency, high load, or unavailable).
- **Advanced Filtering**: Quickly find models by type (Free, Reasoning, Image, Thinking) or search by name.
- **Account Overview**: Monitor your OpenRouter API key usage, limits, and rate limits directly from the dashboard.
- **Vercel Optimized**: Built-in support for Vercel Serverless Functions to handle API proxying and avoid CORS issues.
- **Dark Mode UI**: A sleek, high-contrast interface designed for developers.

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS 4, Shadcn UI
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Backend**: Vercel Serverless Functions (Node.js/Express)
- **API**: OpenRouter API

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An [OpenRouter API Key](https://openrouter.ai/keys)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/openrouter-monitor.git
   cd openrouter-monitor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   OPENROUTER_API_KEY=your_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## 📦 Deployment

This project is optimized for deployment on **Vercel**.

1. Push your code to GitHub.
2. Connect your repository to Vercel.
3. Add your `OPENROUTER_API_KEY` to the Vercel Environment Variables.
4. Deploy!

The `vercel.json` configuration handles all API routing and SPA fallback automatically.

## 🔒 Security

- **API Keys**: Users can input their own API keys which are stored securely in `localStorage`.
- **Server-Side Proxy**: Sensitive requests are proxied through Vercel Serverless Functions to protect API keys and handle headers securely.

## 📜 License

MIT License - feel free to use this project for your own monitoring needs!

---

*Built with ❤️ for the AI Developer Community.*
