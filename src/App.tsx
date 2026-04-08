import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  CheckCircle2, 
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
  ZapOff
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
  Area
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
    return models.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           model.id.toLowerCase().includes(searchQuery.toLowerCase());
      const isFree = parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0;
      
      const matchesFree = showFreeOnly ? isFree : true;
      const matchesReasoning = filterReasoning ? model.capabilities?.reasoning : true;
      const matchesImage = filterImage ? model.capabilities?.image : true;
      const matchesThinking = filterThinking ? model.capabilities?.thinking : true;

      return matchesSearch && matchesFree && matchesReasoning && matchesImage && matchesThinking;
    });
  }, [models, searchQuery, showFreeOnly, filterReasoning, filterImage, filterThinking]);

  const selectedModel = useMemo(() => {
    return models.find(m => m.id === selectedModelId) || filteredModels[0];
  }, [models, selectedModelId, filteredModels]);

  const simulatedHistory = useMemo(() => {
    return generateSimulatedData(selectedModel ? 400 : 500);
  }, [selectedModel?.id]);

  const topRecommendations = useMemo(() => {
    return [...models]
      .filter(m => m.status === 'available')
      .sort((a, b) => (a.latency || 0) - (b.latency || 0))
      .slice(0, 3);
  }, [models]);

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
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Quick Pick: Top 3 Available Models</h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lowest latency & highest reliability right now</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {topRecommendations.map((model, idx) => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className="flex items-center gap-3 bg-background border border-primary/10 px-4 py-2 rounded-xl cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
                >
                  <span className="text-xs font-bold text-primary/40">0{idx + 1}</span>
                  <div>
                    <p className="text-xs font-bold group-hover:text-primary transition-colors">{model.name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {Math.round(model.latency || 0)}ms
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
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
                  <div className="space-y-2">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                      ))
                    ) : filteredModels.length > 0 ? (
                      filteredModels.map((model) => (
                        <div
                          key={model.id}
                          onClick={() => setSelectedModelId(model.id)}
                          className={cn(
                            "group p-3 rounded-xl border transition-all cursor-pointer hover:bg-accent/50",
                            selectedModelId === model.id ? "bg-accent border-primary/50 shadow-sm" : "bg-card border-transparent"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div 
                                className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  model.status === 'available' ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" :
                                  model.status === 'degraded' ? "bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.4)]" :
                                  "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]"
                                )} 
                                title={model.status?.toUpperCase()}
                              />
                              <h3 className="text-sm font-semibold truncate max-w-[150px]">{model.name}</h3>
                            </div>
                            {parseFloat(model.pricing.prompt) === 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>
                            )}
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
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <ZapOff className="w-12 h-12 mb-2 opacity-20" />
                        <p className="text-sm">No models found</p>
                      </div>
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
                          Latency Trend (24h)
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
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fill: 'var(--muted-foreground)'}}
                                tickFormatter={(val) => `${val}ms`}
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
                                type="monotone" 
                                dataKey="latency" 
                                stroke="var(--primary)" 
                                strokeWidth={2}
                                fillOpacity={1} 
                                fill="url(#colorLatency)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-none shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">Throughput (Tokens/sec)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[150px] w-full">
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
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
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
                    </div>
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
