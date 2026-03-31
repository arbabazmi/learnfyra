import { Link } from 'react-router';
import {
  GraduationCap,
  BookOpen,
  Target,
  Sparkles,
  TrendingUp,
  Users,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export default function Landing() {
  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Questions',
      description: 'Generate unlimited practice questions tailored to each student\'s learning level',
    },
    {
      icon: Target,
      title: 'Personalized Learning',
      description: 'Adaptive difficulty based on student performance and progress',
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Analytics',
      description: 'Track progress with detailed insights and performance metrics',
    },
    {
      icon: BookOpen,
      title: 'Multi-Subject Support',
      description: 'Math, Science, English, and more for grades 1-10',
    },
    {
      icon: Users,
      title: 'Teacher & Parent Portal',
      description: 'Collaborate seamlessly with dedicated dashboards',
    },
    {
      icon: Check,
      title: 'Instant Validation',
      description: 'AI validates answers and provides helpful explanations',
    },
  ];

  const roles = [
    {
      title: 'For Students',
      description: 'Practice, learn, and track your progress with personalized worksheets',
      link: '/student/dashboard',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'For Teachers',
      description: 'Create and assign worksheets, monitor student progress effortlessly',
      link: '/teacher/dashboard',
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'For Parents',
      description: 'Stay informed about your child\'s learning journey and achievements',
      link: '/parent/dashboard',
      color: 'from-green-500 to-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-semibold">Learnfyra</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost">Sign In</Button>
            <Button>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-background to-background opacity-50" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-light border border-primary/20 text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                AI-Powered Learning Platform
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                Transform Learning with{' '}
                <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                  AI-Powered
                </span>{' '}
                Worksheets
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                Empower students from Grade 1-10 with personalized, AI-generated worksheets. 
                Track progress, validate answers, and make learning engaging.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="gap-2">
                  Start Learning Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-4">
                <div>
                  <div className="text-3xl font-bold">50K+</div>
                  <div className="text-sm text-muted-foreground">Students</div>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <div className="text-3xl font-bold">2K+</div>
                  <div className="text-sm text-muted-foreground">Teachers</div>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <div className="text-3xl font-bold">500K+</div>
                  <div className="text-sm text-muted-foreground">Worksheets</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-3xl blur-3xl opacity-20" />
              <Card className="relative p-8 border-2">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold">
                        PS
                      </div>
                      <div>
                        <div className="font-semibold">Priya's Dashboard</div>
                        <div className="text-sm text-muted-foreground">Grade 7 • Math</div>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-success-light text-[#10b981] text-xs font-medium">
                      92% Accuracy
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">24</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">8</div>
                      <div className="text-xs text-muted-foreground">In Progress</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">15h</div>
                      <div className="text-xs text-muted-foreground">Study Time</div>
                    </div>
                  </div>
                  <div className="h-32 rounded-lg bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10 flex items-end gap-2 px-4 pb-4">
                    {[65, 72, 85, 78, 90, 88, 92].map((value, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-[#6366f1] to-[#8b5cf6]"
                        style={{ height: `${value}%` }}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Everything You Need for Effective Learning
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to make learning engaging and measurable
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#6366f1]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Built for Every Learning Journey
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're a student, teacher, or parent, we have you covered
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {roles.map((role, index) => (
              <Card key={index} className="p-8 hover:shadow-xl transition-all group">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-6`}
                >
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{role.title}</h3>
                <p className="text-muted-foreground mb-6">{role.description}</p>
                <Link to={role.link}>
                  <Button variant="ghost" className="gap-2 group-hover:gap-3 transition-all">
                    Explore Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Transform Your Learning Experience?
          </h2>
          <p className="text-lg mb-8 text-white/90">
            Join thousands of students, teachers, and parents already using Learnfyra
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">Learnfyra</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Learnfyra. Empowering education with AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
