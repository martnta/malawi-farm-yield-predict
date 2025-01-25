'use client'

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts'
import { ChartContainer } from "@/components/ui/chart"
import { AlertCircle, Droplets, Upload } from 'lucide-react'

interface PredictionData {
  rainfall: number;
  yield: number;
  provider: 'openai' | 'anthropic' | 'llama' | 'historical';
  timestamp: string;
  comment?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PredictionData }>;
}

export default function Home() {
  const [rainfall, setRainfall] = useState<number>(900)
  const [chartData, setChartData] = useState<PredictionData[]>([])
  const [error, setError] = useState<string>('')
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'llama'>('openai')
  const [isLoading, setIsLoading] = useState(false)
  const [latestPrediction, setLatestPrediction] = useState<PredictionData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePredict = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (rainfall < 0) {
      setError('Rainfall cannot be negative')
      setIsLoading(false)
      return
    }

    if (rainfall > 5000) {
      setError('Please enter a realistic rainfall value (less than 5000mm)')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rainfall, provider }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prediction');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const newPrediction: PredictionData = {
        rainfall,
        yield: parseFloat(data.prediction),
        provider,
        timestamp: data.timestamp,
        comment: data.comment
      };

      setLatestPrediction(newPrediction);
      setChartData(prevData => {
        const newData = [...prevData, newPrediction].sort((a, b) => a.rainfall - b.rainfall);
        return newData.filter((v, i, a) => 
          i === a.findIndex(t => t.rainfall === v.rainfall && t.provider === v.provider)
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      const result = await response.json() as { success: boolean; data?: PredictionData[]; message?: string }
      if (result.success && result.data) {
        const historicalData = result.data.map((item) => ({
          ...item,
          provider: 'historical' as const,
          timestamp: new Date().toISOString()
        }))
        setChartData(prevData => [...prevData, ...historicalData])
      } else {
        setError(result.message || 'Error uploading file')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error uploading file')
    }
  }

  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">Rainfall: {data.rainfall}mm</p>
          <p>Yield: {data.yield.toFixed(2)} metric tons/hectare</p>
          <Badge variant={
            data.provider === 'openai' ? 'default' :
            data.provider === 'anthropic' ? 'secondary' :
            data.provider === 'llama' ? 'destructive' : 'outline'
          }>
            {data.provider}
          </Badge>
          {data.comment && <p className="mt-2 text-sm">{data.comment}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Droplets className="h-6 w-6" />
            <CardTitle>Malawi Farm Yield Predictor</CardTitle>
          </div>
          <CardDescription>
            Enter rainfall data or upload a CSV file to predict farm yield using AI. Our model considers Malawi's typical
            rainfall patterns and agricultural conditions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePredict} className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-grow">
                <Input
                  type="number"
                  value={rainfall}
                  onChange={(e) => setRainfall(Number(e.target.value))}
                  placeholder="Enter rainfall in mm"
                  className="w-full"
                  min="0"
                  max="5000"
                  step="1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Typical range: 725mm - 2,500mm annually
                </p>
              </div>
              <Select value={provider} onValueChange={(value: 'openai' | 'anthropic' | 'llama') => setProvider(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="llama">Llama</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Predicting...' : 'Predict Yield'}
              </Button>
            </div>
          </form>

          <div className="mt-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" /> Upload CSV
            </Button>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV file with 'rainfall' and 'yield' columns
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {latestPrediction && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Latest Prediction</h3>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {latestPrediction.yield.toFixed(2)} metric tons/hectare
                </p>
                <Badge variant={
                  latestPrediction.provider === 'openai' ? 'default' :
                  latestPrediction.provider === 'anthropic' ? 'secondary' :
                  'destructive'
                }>
                  {latestPrediction.provider}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {latestPrediction.rainfall}mm annual rainfall
              </p>
              {latestPrediction.comment && (
                <p className="mt-2 text-sm">{latestPrediction.comment}</p>
              )}
            </div>
          )}

          {chartData.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Prediction History</h3>
              <div className="flex gap-2 mb-4">
                <Badge variant="default">OpenAI</Badge>
                <Badge variant="secondary">Anthropic</Badge>
                <Badge variant="destructive">Llama</Badge>
                <Badge variant="outline">Historical</Badge>
              </div>
              <ChartContainer
                config={{
                  yield: {
                    label: "Yield (metric tons/hectare)",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="rainfall" 
                      label={{ value: 'Rainfall (mm)', position: 'bottom', offset: -5 }} 
                    />
                    <YAxis 
                      label={{ value: 'Yield (metric tons/hectare)', angle: -90, position: 'left', offset: 15 }} 
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {['openai', 'anthropic', 'llama', 'historical'].map((p) => (
                      <Scatter
                        key={p}
                        name={p.charAt(0).toUpperCase() + p.slice(1)}
                        data={chartData.filter(d => d.provider === p)}
                        fill={p === 'openai' ? 'var(--primary)' : 
                              p === 'anthropic' ? 'var(--secondary)' :
                              p === 'llama' ? 'var(--destructive)' :
                              'var(--muted)'}
                        line={true}
                        shape="circle"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

