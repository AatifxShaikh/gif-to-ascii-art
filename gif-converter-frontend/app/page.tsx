"use client";

import { useState, useEffect, useRef } from 'react';
import { Upload, Link, Film, LoaderCircle, Search, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AsciiApiResponse {
  frames: string[];
  duration: number;
}

interface GiphyResult {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
}

export default function HomePage() {
  const [asciiData, setAsciiData] = useState<AsciiApiResponse | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gifUrl, setGifUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (asciiData && asciiData.frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % asciiData.frames.length);
      }, asciiData.duration);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [asciiData]);

  const handleConversion = async (url: string, body: FormData) => {
    setIsLoading(true);
    setError(null);
    setAsciiData(null);
    setGiphyResults([]);
    try {
      const response = await fetch(url, { method: 'POST', body });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Conversion failed.");
      }
      const data: AsciiApiResponse = await response.json();
      setAsciiData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gifUrl) return;
    const formData = new FormData();
    formData.append('gif_url', gifUrl);
    handleConversion('http://127.0.0.1:8000/api/convert-from-url', formData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    handleConversion('http://127.0.0.1:8000/api/convert-from-upload', formData);
  };

  const handleGiphySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) return;
    setIsLoading(true);
    setError(null);
    setGiphyResults([]);
    setAsciiData(null)
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/search-giphy?query=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "GIPHY search failed.");
      }
      const data: GiphyResult[] = await response.json();
      setGiphyResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGiphySelect = (resultUrl: string) => {
    setGifUrl(resultUrl);
    const formData = new FormData();
    formData.append('gif_url', resultUrl);
    handleConversion('http://127.0.0.1:8000/api/convert-from-url', formData);
  };

  // --- JSX ---
  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-5xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">GIF to ASCII</h1>
          <p className="text-lg text-neutral-400">Animate any GIF in pure text.</p>
        </header>

        {/* --- Input Card --- */}
        <Card className="bg-neutral-950 border-neutral-800">
          <CardHeader>
            <CardTitle>Choose your GIF</CardTitle>
            <CardDescription>Search GIPHY, paste a URL, or upload a file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* GIPHY Search */}
            <form onSubmit={handleGiphySearch} className="space-y-2">
              <Label htmlFor="giphySearch" className="flex items-center gap-2"><Search size={16} /> Search GIPHY</Label>
              <div className="flex gap-2">
                <Input id="giphySearch" type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="e.g., funny cat, programming..." className="bg-black text-white border-neutral-700" disabled={isLoading} />
                <Button type="submit" disabled={isLoading}>Search</Button>
              </div>
            </form>
            {/* URL Input */}
            <form onSubmit={handleUrlSubmit} className="space-y-2">
              <Label htmlFor="gifUrl" className="flex items-center gap-2"><Link size={16} /> Or From URL</Label>
              <Input id="gifUrl" type="url" value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="https://media.giphy.com/..." className="bg-black text-white border-neutral-700" disabled={isLoading} />
            </form>
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="fileUpload" className="flex items-center gap-2"><Upload size={16} /> Or Upload</Label>
              <Input id="fileUpload" type="file" accept="image/gif,image/webp" onChange={handleFileUpload} className="bg-black border-neutral-700 text-white file:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:bg-neutral-800 hover:file:bg-neutral-700 cursor-pointer" disabled={isLoading} />
            </div>
          </CardContent>
        </Card>

        {/* --- Display Area --- */}
        <div className="bg-black border-neutral-800 border rounded-lg w-full min-h-96 flex items-center justify-center overflow-hidden p-2">
          {isLoading ? (
            <div className="flex flex-col items-center text-neutral-400"><LoaderCircle className="animate-spin mb-4" size={48} /><span>Loading...</span></div>
          ) : error ? (
            <div className="text-red-500 p-4 text-center"><p className="font-bold">Error:</p><p>{error}</p></div>
          ) : asciiData ? (
            <pre className="text-[10px] leading-tight font-mono text-center text-white whitespace-pre-wrap break-all">{asciiData.frames[currentFrame]}</pre>
          ) : giphyResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 max-h-96 overflow-y-auto">
              {giphyResults.map((gif) => (
                <button key={gif.id} onClick={() => handleGiphySelect(gif.url)} className="aspect-square relative group bg-neutral-900 rounded-md overflow-hidden">
                  <img src={gif.thumbnail_url} alt={gif.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Film className="text-white" size={32} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-neutral-600 text-center flex flex-col items-center gap-4"><ImageIcon size={48} /><p>Your ASCII art will appear here</p></div>
          )}
        </div>
      </div>
    </main>
  );
}
