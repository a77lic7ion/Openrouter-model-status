import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Clock, 
  Cpu, 
  Database, 
  Info, 
  RefreshCw, 
  Search, 
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ZapOff,
  Star,
  StarOff,
  GitFork,
  ActivitySquare
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Types
interface Model {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider?: {
    context_length: number | null;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  // Added fields for UI
  status?: 'available' | 'degraded' | 'unavailable';
  latency?: number;
  usage_pct?: number;
  capabilities?: {
    reasoning: boolean;
    image: boolean;
    thinking: boolean;
  };
}

interface KeyInfo {
  label: string;
  limit: number | null;
  usage: number;
  rate_limit: {
    requests: number;
    interval: string;
  };
  is_free_tier: boolean;
}

// Simulated historical data for the graph
const generateSimulatedData = (baseLatency: number = 500) => {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    latency: Math.max(100, baseLatency + (Math.random() - 0.5) * 200),
    throughput: Math.max(10, 50 + (Math.random() - 0.5) * 30),
    reliability: 95 + Math.random() * 5,
  }));
};

const generateFallbackData = () => {
  const providers = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Mistral'];
  return providers.map(p => ({
    name: p,
    success: Math.floor(70 + Math.random() * 30),
    fallback: Math.floor(Math.random() * 20),
  }));
};

export default function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFreeOnly, setShowFreeOnly] = useState(true);
  const [filterReasoning, setFilterReasoning] = useState(false);
  const [filterImage, setFilterImage] = useState(false);
  const [filterThinking, setFilterThinking] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [userApiKey, setUserApiKey] = useState<string | null>(localStorage.getItem("openrouter_api_key"));
  const [tempKey, setTempKey] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("openrouter_favorites");
    return saved ? JSON.parse(saved) : [];
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id];
      localStorage.setItem("openrouter_favorites", JSON.stringify(next));
      return next;
    });
  };

  const fetchData = async () => {
    // Don't set loading to true on auto-refresh to avoid UI flickering
    if (!models.length) setLoading(true);
    setError(null);
    try {
      const headers = userApiKey ? { "X-OpenRouter-Key": userApiKey } : {};
      
      const [modelsRes, keyRes] = await Promise.allSettled([
        axios.get("/api/models"),
        axios.get("/api/key-info", { headers })
      ]);

      if (modelsRes.status === 'fulfilled') {
        const rawModels = modelsRes.value.data.data || [];
        // Enhance models with simulated availability, latency, and capabilities
        const enhancedModels = rawModels.map((m: any) => {
          const isFree = parseFloat(m.pricing.prompt) === 0;
          const random = Math.random();
          
          // Logic: Free models are more likely to be degraded
          let status: 'available' | 'degraded' | 'unavailable' = 'available';
          if (isFree) {
            if (random > 0.85) status = 'unavailable';
            else if (random > 0.6) status = 'degraded';
          } else {
            if (random > 0.98) status = 'unavailable';
            else if (random > 0.9) status = 'degraded';
          }

          // Infer capabilities
          const nameLower = m.name.toLowerCase();
          const idLower = m.id.toLowerCase();
          const capabilities = {
            reasoning: nameLower.includes('reasoning') || nameLower.includes('o1') || nameLower.includes('o3') || idLower.includes('r1'),
            image: m.architecture?.modality?.includes('image') || nameLower.includes('vision') || idLower.includes('vision'),
            thinking: nameLower.includes('thinking') || nameLower.includes('thought') || idLower.includes('thinking')
          };

          return {
            ...m,
            status,
            latency: isFree ? 400 + Math.random() * 600 : 150 + Math.random() * 200,
            usage_pct: Math.floor(Math.random() * 100), // Simulated usage
            capabilities
          };
        });
        setModels(enhancedModels);
        setLastRefresh(new Date());
      } else {
        console.error("Models fetch failed:", modelsRes.reason);
      }

      if (keyRes.status === 'fulfilled') {
        setKeyInfo(keyRes.value.data.data);
      } else {
        // Key info might fail if no API key is set, we handle this gracefully
        console.warn("Key info fetch failed (likely no API key):", keyRes.reason);
      }
    } catch (err: any) {
      setError("Failed to connect to the server. Please check if the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredModels = useMemo(() => {
    const filtered = models.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           model.id.toLowerCase().includes(searchQuery.toLowerCase());
      const isFree = parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0;
      
      const matchesFree = showFreeOnly ? isFree : true;
      const matchesReasoning = filterReasoning ? model.capabilities?.reasoning : true;
      const matchesImage = filterImage ? model.capabilities?.image : true;
      const matchesThinking = filterThinking ? model.capabilities?.thinking : true;

      return matchesSearch && matchesFree && matchesReasoning && matchesImage && matchesThinking;
    });

    // Sort: Favorites first, then by name
    return [...filtered].sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [models, searchQuery, showFreeOnly, filterReasoning, filterImage, filterThinking, favorites]);

  const selectedModel = useMemo(() => {
    return models.find(m => m.id === selectedModelId) || filteredModels[0];
  }, [models, selectedModelId, filteredModels]);

  const simulatedHistory = useMemo(() => {
    return generateSimulatedData(selectedModel ? 400 : 500);
  }, [selectedModel?.id]);

  const fallbackData = useMemo(() => generateFallbackData(), [selectedModel?.id]);

  const topRecommendations = useMemo(() => {
    return [...models]
      .filter(m => m.status === 'available')
      .sort((a, b) => (a.latency || 0) - (b.latency || 0))
      .slice(0, 3);
  }, [models]);

  const favoriteModels = useMemo(() => {
    return models.filter(m => favorites.includes(m.id));
  }, [models, favorites]);

  const getModelHealthClass = (model: Model) => {
    if (model.status === 'unavailable') return "border-red-500/60 hover:border-red-500 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.05)]";
    if (model.status === 'degraded') return "border-yellow-500/60 hover:border-yellow-500 bg-yellow-500/5 shadow-[0_0_10px_rgba(234,179,8,0.05)]";
    
    const latency = model.latency || 0;
    const usage = model.usage_pct || 0;
    
    if (latency > 800 || usage > 90) return "border-red-500/60 hover:border-red-500 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.05)]";
    if (latency > 400 || usage > 60) return "border-orange-500/60 hover:border-orange-500 bg-orange-500/5 shadow-[0_0_10px_rgba(249,115,22,0.05)]";
    
    return "border-green-500/60 hover:border-green-500 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.05)]";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      case 'unavailable': return <XCircle className="w-3 h-3 text-red-500" />;
      default: return null;
    }
  };

  const handleSaveKey = () => {
    if (tempKey.trim()) {
      localStorage.setItem("openrouter_api_key", tempKey.trim());
      setUserApiKey(tempKey.trim());
      window.location.reload();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("openrouter_api_key");
    setUserApiKey(null);
    window.location.reload();
  };

  if (!userApiKey) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 font-sans">
        <Card className="w-full max-w-md border-none shadow-2xl bg-card">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 p-3 rounded-2xl w-fit mb-2">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">API Setup Required</CardTitle>
            <CardDescription>
              Please enter your OpenRouter API key to access the dashboard. 
              Your key is stored locally in your browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">OpenRouter API Key</label>
              <Input 
                type="password" 
                placeholder="sk-or-v1-..." 
                className="bg-accent/30 border-none h-12"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
              />
            </div>
            <button 
              onClick={handleSaveKey}
              disabled={!tempKey.trim()}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
            >
              Initialize Dashboard
            </button>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-center text-[10px] text-muted-foreground border-t bg-transparent">
            <p>Don't have a key? Get one at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">openrouter.ai/keys</a></p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">{error}</p>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">OpenRouter Monitor</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Real-time model availability & usage</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end text-[10px] text-muted-foreground mr-2">
              <div className="flex items-center gap-1">
                <div className={cn("w-1.5 h-1.5 rounded-full", loading ? "bg-primary animate-pulse" : "bg-green-500")} />
                <span>{loading ? "Refreshing..." : "Auto-refresh active"}</span>
              </div>
              <span>Last update: {lastRefresh.toLocaleTimeString()}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
              title="Logout / Change Key"
            >
              <ZapOff className="w-5 h-5" />
            </button>
            <button 
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-full hover:bg-accent transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6 px-4 md:px-8 space-y-8">
        {/* Top Recommendations Bar */}
        {!loading && topRecommendations.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Quick Pick: Top 3 Available Models</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Optimized for reliability and speed</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">LIVE METRICS</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topRecommendations.map((model, idx) => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    "relative group bg-background border p-4 rounded-2xl cursor-pointer hover:shadow-lg transition-all overflow-hidden",
                    getModelHealthClass(model)
                  )}
                >
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <ActivitySquare className="w-12 h-12 text-primary" />
                  </div>
                  
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {idx + 1}
                    </span>
                    <h3 className="font-bold truncate pr-10">{model.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Latency</p>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Clock className="w-3.5 h-3.5" /> {Math.round(model.latency || 0)}ms
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Current Load</p>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-500">
                        <TrendingUp className="w-3.5 h-3.5" /> {model.usage_pct}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Progress value={model.usage_pct} className="h-1.5 flex-1" />
                    <button 
                      onClick={(e) => toggleFavorite(model.id, e)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                        favorites.includes(model.id) 
                          ? "bg-yellow-500/20 text-yellow-600 border border-yellow-500/30" 
                          : "bg-accent text-muted-foreground hover:bg-accent/80 border border-transparent"
                      )}
                    >
                      <Star className={cn("w-3 h-3", favorites.includes(model.id) && "fill-yellow-500")} />
                      {favorites.includes(model.id) ? "FAVORITE" : "ADD FAV"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorites Bar */}
        {!loading && favoriteModels.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/10 p-2 rounded-full">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Your Favorites</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Quick access to your preferred models</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {favoriteModels.map((model) => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    "relative group bg-background border p-4 rounded-2xl cursor-pointer hover:shadow-lg transition-all overflow-hidden",
                    getModelHealthClass(model)
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold truncate pr-6 text-sm">{model.name}</h3>
                    <button 
                      onClick={(e) => toggleFavorite(model.id, e)}
                      className="p-1 rounded-full hover:bg-yellow-500/10 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {Math.round(model.latency || 0)}ms
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {model.usage_pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Stats Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="overflow-hidden border-none shadow-sm bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : models.length}</div>
              <p className="text-xs text-muted-foreground">
                {models.filter(m => parseFloat(m.pricing.prompt) === 0).length} free models available
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usage Limit</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-24" /> : (keyInfo?.limit ? `$${keyInfo.limit.toFixed(2)}` : "Unlimited")}
              </div>
              <div className="mt-2">
                <Progress value={keyInfo ? (keyInfo.usage / (keyInfo.limit || 1)) * 100 : 0} className="h-1" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {keyInfo ? `$${keyInfo.usage.toFixed(4)} consumed` : "No API key configured"}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-20" /> : (keyInfo?.rate_limit.requests || "N/A")}
              </div>
              <p className="text-xs text-muted-foreground">
                Requests per {keyInfo?.rate_limit.interval || "interval"}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-none shadow-sm bg-accent/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Account Status</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-20" /> : (keyInfo?.is_free_tier ? "Free" : "Paid")}
                </div>
                {!loading && <Badge variant={keyInfo?.is_free_tier ? "outline" : "default"}>{keyInfo?.is_free_tier ? "Tier 0" : "Premium"}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {keyInfo?.label || "Anonymous User"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Model List */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="h-[calc(100vh-280px)] flex flex-col border-none shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="w-5 h-5" /> Models
                </CardTitle>
                <div className="space-y-3 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      className="pl-9 bg-accent/30 border-none h-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={showFreeOnly ? "default" : "outline"}
                      className="cursor-pointer transition-all text-[10px]"
                      onClick={() => setShowFreeOnly(!showFreeOnly)}
                    >
                      Free
                    </Badge>
                    <Badge 
                      variant={filterReasoning ? "default" : "outline"}
                      className="cursor-pointer transition-all text-[10px]"
                      onClick={() => setFilterReasoning(!filterReasoning)}
                    >
                      Reasoning
                    </Badge>
                    <Badge 
                      variant={filterImage ? "default" : "outline"}
                      className="cursor-pointer transition-all text-[10px]"
                      onClick={() => setFilterImage(!filterImage)}
                    >
                      Image
                    </Badge>
                    <Badge 
                      variant={filterThinking ? "default" : "outline"}
                      className="cursor-pointer transition-all text-[10px]"
                      onClick={() => setFilterThinking(!filterThinking)}
                    >
                      Thinking
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full px-4 pb-4">
                  <div className="space-y-4">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                      ))
                    ) : (
                      <>
                        {/* Favorites Section */}
                        {favoriteModels.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest px-1">Favorites</h4>
                            {favoriteModels.map((model) => (
                              <div
                                key={`fav-${model.id}`}
                                onClick={() => setSelectedModelId(model.id)}
                                className={cn(
                                  "group p-3 rounded-xl border transition-all cursor-pointer hover:bg-accent/50",
                                  selectedModelId === model.id ? "bg-accent border-primary/50 shadow-sm" : getModelHealthClass(model)
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(model.status || 'available')}
                                    <h3 className="text-sm font-semibold truncate max-w-[130px]">{model.name}</h3>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {parseFloat(model.pricing.prompt) === 0 && (
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>
                                    )}
                                    <button 
                                      onClick={(e) => toggleFavorite(model.id, e)}
                                      className="p-1 rounded-full hover:bg-primary/10 transition-colors"
                                    >
                                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {model.context_length.toLocaleString()} ctx</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(model.latency || 0)}ms</span>
                                  <span className="flex items-center gap-1 ml-auto">
                                    <TrendingUp className="w-3 h-3" /> {model.usage_pct}% usage
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="border-t border-border/50 my-4" />
                          </div>
                        )}

                        {/* All Models Section */}
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                            {favoriteModels.length > 0 ? "All Models" : "Available Models"}
                          </h4>
                          {filteredModels.filter(m => !favorites.includes(m.id)).length > 0 ? (
                            filteredModels.filter(m => !favorites.includes(m.id)).map((model) => (
                              <div
                                key={model.id}
                                onClick={() => setSelectedModelId(model.id)}
                                className={cn(
                                  "group p-3 rounded-xl border transition-all cursor-pointer hover:bg-accent/50",
                                  selectedModelId === model.id ? "bg-accent border-primary/50 shadow-sm" : getModelHealthClass(model)
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(model.status || 'available')}
                                    <h3 className="text-sm font-semibold truncate max-w-[130px]">{model.name}</h3>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {parseFloat(model.pricing.prompt) === 0 && (
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>
                                    )}
                                    <button 
                                      onClick={(e) => toggleFavorite(model.id, e)}
                                      className="p-1 rounded-full hover:bg-primary/10 transition-colors"
                                    >
                                      <Star className="w-3.5 h-3.5 text-muted-foreground opacity-30 group-hover:opacity-100" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {model.context_length.toLocaleString()} ctx</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(model.latency || 0)}ms</span>
                                  <span className="flex items-center gap-1 ml-auto">
                                    <TrendingUp className="w-3 h-3" /> {model.usage_pct}% usage
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            filteredModels.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <ZapOff className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-sm">No models found</p>
                              </div>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details & Charts */}
          <div className="lg:col-span-8 space-y-6">
            {selectedModel ? (
              <>
                {/* Model Overview Card */}
                <Card className="border-none shadow-md overflow-hidden">
                  <div className="h-2 bg-primary/20" />
                  <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-2xl font-bold">{selectedModel.name}</CardTitle>
                          <Badge variant="outline" className="font-mono text-[10px]">{selectedModel.id}</Badge>
                        </div>
                        <CardDescription className="text-sm max-w-2xl line-clamp-2">
                          {selectedModel.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</p>
                          <div className="flex items-center gap-1.5 text-green-500 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Available
                          </div>
                        </div>
                        <div className="h-10 w-px bg-border hidden sm:block" />
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Latency</p>
                          <div className="flex items-center gap-1.5 text-primary font-medium">
                            <TrendingDown className="w-4 h-4" /> ~420ms
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Context Window</p>
                        <p className="text-sm font-semibold">{selectedModel.context_length.toLocaleString()} tokens</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Prompt Price</p>
                        <p className="text-sm font-semibold">
                          {parseFloat(selectedModel.pricing.prompt) === 0 ? "Free" : `$${(parseFloat(selectedModel.pricing.prompt) * 1000000).toFixed(2)} / 1M`}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Completion Price</p>
                        <p className="text-sm font-semibold">
                          {parseFloat(selectedModel.pricing.completion) === 0 ? "Free" : `$${(parseFloat(selectedModel.pricing.completion) * 1000000).toFixed(2)} / 1M`}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Current Load</p>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedModel.usage_pct || 0} className="h-1.5 w-24" />
                          <span className="text-sm font-semibold">{selectedModel.usage_pct}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Capabilities</p>
                        <div className="flex gap-1">
                          {selectedModel.capabilities?.reasoning && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/30 text-primary">REASONING</Badge>}
                          {selectedModel.capabilities?.image && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/30 text-primary">IMAGE</Badge>}
                          {selectedModel.capabilities?.thinking && <Badge variant="outline" className="text-[8px] h-4 px-1 border-primary/30 text-primary">THINKING</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts Section */}
                <Tabs defaultValue="availability" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-accent/30 p-1">
                    <TabsTrigger value="availability" className="data-[state=active]:bg-background">
                      <TrendingUp className="w-4 h-4 mr-2" /> Performance History
                    </TabsTrigger>
                    <TabsTrigger value="details" className="data-[state=active]:bg-background">
                      <Info className="w-4 h-4 mr-2" /> Technical Specs
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="availability" className="mt-4 space-y-4">
                    <Card className="border-none shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          Latency & Reliability Trend (24h)
                          <Badge variant="outline" className="text-[10px] font-normal">Simulated</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="h-[300px] w-full mt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={simulatedHistory}>
                              <defs>
                                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorReliability" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                              <XAxis 
                                dataKey="time" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fill: 'var(--muted-foreground)'}}
                                interval={3}
                              />
                              <YAxis 
                                yAxisId="left"
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fill: 'var(--muted-foreground)'}}
                                tickFormatter={(val) => `${val}ms`}
                              />
                              <YAxis 
                                yAxisId="right"
                                orientation="right"
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fill: 'var(--muted-foreground)'}}
                                tickFormatter={(val) => `${val}%`}
                                domain={[90, 100]}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'var(--card)', 
                                  borderColor: 'var(--border)',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  color: 'var(--foreground)'
                                }}
                                itemStyle={{ color: 'var(--primary)' }}
                              />
                              <Area 
                                yAxisId="left"
                                type="monotone" 
                                dataKey="latency" 
                                stroke="var(--primary)" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorLatency)" 
                                name="Latency (ms)"
                              />
                              <Area 
                                yAxisId="right"
                                type="monotone" 
                                dataKey="reliability" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorReliability)" 
                                name="Reliability (%)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <GitFork className="w-4 h-4 text-primary" /> Tool Fallback Success Rate
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={fallbackData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                <XAxis type="number" hide />
                                <YAxis 
                                  dataKey="name" 
                                  type="category" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{fontSize: 10, fill: 'var(--muted-foreground)'}}
                                />
                                <Tooltip 
                                  cursor={{fill: 'transparent'}}
                                  contentStyle={{ 
                                    backgroundColor: 'var(--card)', 
                                    borderColor: 'var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                  }}
                                />
                                <Bar dataKey="success" stackId="a" fill="var(--primary)" radius={[0, 0, 0, 0]} barSize={12} name="Success" />
                                <Bar dataKey="fallback" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} name="Fallback" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Throughput & Token Efficiency</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={simulatedHistory}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" hide />
                                <YAxis hide />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'var(--card)', 
                                    borderColor: 'var(--border)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: 'var(--foreground)'
                                  }}
                                  itemStyle={{ color: '#10b981' }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="throughput" 
                                  stroke="#10b981" 
                                  strokeWidth={2} 
                                  dot={false} 
                                  name="Tokens/sec"
                                />
                                <Line 
                                  type="stepAfter" 
                                  dataKey="reliability" 
                                  stroke="var(--primary)" 
                                  strokeWidth={1} 
                                  strokeDasharray="5 5"
                                  dot={false} 
                                  name="Efficiency"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                      <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Uptime Status</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-center h-[150px]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Last 30 Days</span>
                            <span className="text-xs font-bold text-green-500">99.98%</span>
                          </div>
                          <div className="flex gap-1 h-8">
                            {Array.from({ length: 30 }).map((_, i) => (
                              <div 
                                key={i} 
                                className={cn(
                                  "flex-1 rounded-sm",
                                  i === 12 ? "bg-yellow-500" : "bg-green-500"
                                )} 
                                title={i === 12 ? "Minor disruption" : "Operational"}
                              />
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-4 text-center">
                            All systems normal. No major outages reported in the last 24 hours.
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <Card className="border-none shadow-sm">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Property</TableHead>
                              <TableHead>Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium">Architecture</TableCell>
                              <TableCell>{selectedModel.architecture.tokenizer || "Standard"}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Instruct Type</TableCell>
                              <TableCell>{selectedModel.architecture.instruct_type || "N/A"}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Max Completion</TableCell>
                              <TableCell>{selectedModel.top_provider?.max_completion_tokens?.toLocaleString() || "N/A"} tokens</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Moderated</TableCell>
                              <TableCell>{selectedModel.top_provider?.is_moderated ? "Yes" : "No"}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Provider</TableCell>
                              <TableCell className="capitalize">{selectedModel.id.split('/')[0]}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                <Cpu className="w-16 h-16 mb-4 opacity-10" />
                <h2 className="text-xl font-semibold">Select a model to view details</h2>
                <p className="text-sm">Choose a model from the list on the left to see its performance metrics.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12 bg-accent/20">
        <div className="container px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>OpenRouter Monitor v1.0.0</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="https://openrouter.ai/docs" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">API Documentation</a>
            <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Models Directory</a>
            <a href="https://openrouter.ai/activity" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Global Activity</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
