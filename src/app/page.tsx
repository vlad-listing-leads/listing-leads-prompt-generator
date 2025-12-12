import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MousePointer2, Download, Eye, Sparkles, CheckCircle2 } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#141414] overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#141414]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image
            src="/logo-white.svg"
            alt="Listing Leads"
            width={160}
            height={24}
            priority
          />
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-0 px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8 sm:gap-12 text-center">
          {/* Badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 px-3 py-1.5 bg-[#f5d5d5]/10 border border-[#f5d5d5]/20 rounded-full">
            <Sparkles className="w-4 h-4 text-[#f5d5d5]" />
            <span className="text-sm text-[#f5d5d5]">Listings Editor</span>
          </div>

          {/* Title with gradient */}
          <h1 className="animate-fade-in animation-delay-100 text-4xl sm:text-6xl lg:text-7xl font-semibold leading-[1.1] tracking-tight text-balance">
            <span className="text-white">
              Edit your listing assets
            </span>
            <br />
            <span className="text-[#f5d5d5]">
              yourself, in seconds
            </span>
          </h1>

          {/* Description */}
          <p className="animate-fade-in animation-delay-200 text-lg sm:text-xl text-gray-400 max-w-2xl font-medium text-balance">
            All your marketing assets in one place. Make changes instantly.
            No design tools. No waiting.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in animation-delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg shadow-white/10"
            >
              Log in
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-transparent text-white border border-white/20 rounded-xl font-medium hover:bg-white/5 transition-all hover:scale-105"
            >
              Create an account
            </Link>
          </div>

          {/* Screenshot with glow */}
          <div className="animate-fade-in animation-delay-500 relative w-full pt-8 sm:pt-12">
            {/* Glow effect */}
            <div className="absolute inset-0 top-1/4">
              <div className="absolute inset-x-0 top-0 h-[500px] bg-gradient-to-b from-[#f5d5d5]/20 via-[#f5d5d5]/5 to-transparent blur-3xl" />
            </div>

            {/* Screenshot */}
            <div className="relative rounded-t-2xl overflow-hidden shadow-2xl border border-white/10 border-b-0">
              <Image
                src="/preview.png"
                alt="Listings Editor Interface"
                width={1200}
                height={800}
                className="w-full h-auto"
                priority
              />
              {/* Fade to background at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#141414] to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-16 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#f5d5d5]/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-[#f5d5d5]/20">
                <MousePointer2 className="w-5 h-5 text-[#f5d5d5]" />
              </div>
              <p className="text-sm text-gray-400">Click any element to edit</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#f5d5d5]/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-[#f5d5d5]/20">
                <Eye className="w-5 h-5 text-[#f5d5d5]" />
              </div>
              <p className="text-sm text-gray-400">See changes in real-time</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#f5d5d5]/10 rounded-xl flex items-center justify-center mx-auto mb-3 border border-[#f5d5d5]/20">
                <Download className="w-5 h-5 text-[#f5d5d5]" />
              </div>
              <p className="text-sm text-gray-400">Download ready-to-use assets</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-[#1a1a1a]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white text-center mb-4">
            How it works
          </h2>
          <p className="text-gray-400 text-center mb-12">
            From template to download in under a minute
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {[
              { step: '1', title: 'Select template', desc: 'Choose your asset' },
              { step: '2', title: 'AI applies', desc: 'Brand & content' },
              { step: '3', title: 'Preview', desc: 'See the result' },
              { step: '4', title: 'Adjust', desc: 'Fine-tune details' },
              { step: '5', title: 'Download', desc: 'Get your file' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="bg-[#1e1e1e] border border-white/5 rounded-xl p-4 text-center hover:border-[#f5d5d5]/30 transition-colors">
                  <div className="w-8 h-8 bg-[#f5d5d5] rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-semibold text-gray-900">
                    {item.step}
                  </div>
                  <div className="text-sm font-medium text-white mb-1">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.desc}</div>
                </div>
                {i < 4 && (
                  <div className="hidden sm:block absolute top-1/2 -right-2 w-4 text-gray-600">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Reinforcement */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white text-center mb-12">
            Why agents love it
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: 'No design tools required', desc: 'Edit directly in your browser. No Photoshop, no Canva, no learning curve.' },
              { title: 'No waiting on revisions', desc: 'Make changes yourself, right when you need them. No back-and-forth.' },
              { title: 'Changes apply instantly', desc: 'See your updates in real-time. What you see is what you get.' },
              { title: 'Assets stay on-brand', desc: 'Templates are locked to your brand. Only the content changes.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-5 bg-[#1e1e1e] border border-white/5 rounded-xl">
                <div className="shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#f5d5d5]" />
                </div>
                <div>
                  <div className="font-medium text-white mb-1">{item.title}</div>
                  <div className="text-sm text-gray-400">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-6 bg-[#1a1a1a]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
            Ready to take control of your listings?
          </h2>
          <p className="text-gray-400 mb-8">
            Join real estate professionals who edit their own marketing assets
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              Log in
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-transparent text-white border border-white/20 rounded-xl font-medium hover:bg-white/5 transition-colors"
            >
              Create an account
            </Link>
          </div>

          <p className="text-sm text-gray-600">
            Used by agents, teams, and brokerages
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image
            src="/logo-white.svg"
            alt="Listing Leads"
            width={120}
            height={18}
            className="opacity-50"
          />
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Listing Leads. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
