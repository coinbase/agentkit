"use client";
import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AgentInterface from '@/components/AgentInterface';

const GridBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-8 gap-px opacity-20">
        {Array.from({ length: 64 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square border border-white/10 hover:bg-white/5 transition-colors duration-300"
          />
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#00120f] text-white overflow-hidden">
      {/* Grid Background */}
      <GridBackground />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-md' : ''
        }`}>
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-tight"> </div>
          <div className="flex gap-8 items-center">
            <button className="text-white/70 hover:text-white transition-colors">Platform</button>
            <button className="text-white/70 hover:text-white transition-colors">Solutions</button>
            <button className="text-white/70 hover:text-white transition-colors">Technology</button>
            <button className="relative px-4 py-2 border border-white/20 hover:border-white transition-colors">
              Get Started
            </button>
          </div>
          <div className="relative px-4 py-2 border border-white/20 hover:border-white transition-colors">
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        <div className="container mx-auto px-6 pt-32">
          <div className="max-w-4xl">
            <h1 className="text-7xl font-bold tracking-tight leading-tight mb-8">
              Building the Future
              <br />
              <span className="text-neutral-400">of Digital Trust</span>
            </h1>
            <p className="text-xl text-neutral-400 mb-12 max-w-2xl">
              Empowering the next generation of decentralized applications
              with enterprise-grade infrastructure and tools.
            </p>
            <div className="flex gap-6">
              {isAgentOpen ? (
                     <AgentInterface />
               ) : (
            <button className="group px-6 py-3 bg-white text-black font-medium flex items-center gap-2 hover:bg-neutral-200 transition-colors"
                onClick={() => setIsAgentOpen(true)}>
                 Start Chatting with DCAi Bot
                 <ArrowRight className="group-hover:translate-x-1 transition-transform" />
               </button>
              )}

            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: "$1B+", label: "Total Value Secured" },
              { value: "1M+", label: "Transactions Processed" },
              { value: "100+", label: "Enterprise Clients" }
            ].map((stat, index) => (
              <div key={index} className="group border border-white/10 p-8 hover:border-white/30 transition-colors">
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-neutral-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="container mx-auto px-6 py-24">
          <div className="grid grid-cols-2 gap-8">
            {[
              { title: "Enterprise Security", desc: "Bank-grade security protocols with multi-layer protection" },
              { title: "Scalable Infrastructure", desc: "Built to handle millions of transactions per second" },
              { title: "Developer Tools", desc: "Comprehensive SDK and API documentation" },
              { title: "24/7 Support", desc: "Round-the-clock technical assistance and monitoring" }
            ].map((feature, index) => (
              <div key={index} className="group border border-white/10 p-8 hover:border-white/30 transition-colors">
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-neutral-400">{feature.desc}</p>
                <div className="mt-8 h-px w-full bg-gradient-to-r from-white/20 to-transparent group-hover:from-white/40 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer line */}
      <div className="fixed bottom-0 left-0 right-0 h-px bg-white/10" />
    </div>
  );
};

export default Home;