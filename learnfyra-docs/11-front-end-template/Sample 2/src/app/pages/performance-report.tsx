import { Link } from 'react-router';
import {
  TrendingUp,
  Award,
  Target,
  Clock,
  BookOpen,
  ChevronLeft,
  Download,
  Calendar,
  Brain,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function PerformanceReport() {
  const overallTrend = [
    { week: 'Week 1', score: 65, target: 70 },
    { week: 'Week 2', score: 72, target: 72 },
    { week: 'Week 3', score: 85, target: 75 },
    { week: 'Week 4', score: 78, target: 77 },
    { week: 'Week 5', score: 90, target: 80 },
    { week: 'Week 6', score: 88, target: 82 },
    { week: 'Week 7', score: 92, target: 85 },
  ];

  const subjectPerformance = [
    { subject: 'Math', score: 92, worksheets: 12, improvement: '+8%' },
    { subject: 'Science', score: 85, worksheets: 8, improvement: '+5%' },
    { subject: 'English', score: 95, worksheets: 15, improvement: '+12%' },
    { subject: 'Social Studies', score: 78, worksheets: 6, improvement: '+3%' },
    { subject: 'Hindi', score: 88, worksheets: 10, improvement: '+7%' },
  ];

  const skillsRadar = [
    { skill: 'Problem Solving', score: 90 },
    { skill: 'Critical Thinking', score: 85 },
    { skill: 'Speed', score: 78 },
    { skill: 'Accuracy', score: 92 },
    { skill: 'Consistency', score: 88 },
  ];

  const weeklyActivity = [
    { day: 'Mon', worksheets: 3, time: 45 },
    { day: 'Tue', worksheets: 2, time: 30 },
    { day: 'Wed', worksheets: 4, time: 60 },
    { day: 'Thu', worksheets: 3, time: 45 },
    { day: 'Fri', worksheets: 5, time: 75 },
    { day: 'Sat', worksheets: 2, time: 30 },
    { day: 'Sun', worksheets: 1, time: 15 },
  ];

  const achievements = [
    {
      title: '7 Day Streak',
      description: 'Completed worksheets for 7 consecutive days',
      earned: 'Mar 25, 2026',
      icon: Award,
      color: 'from-yellow-400 to-orange-500',
    },
    {
      title: '90% Club',
      description: 'Maintained 90%+ average for a month',
      earned: 'Mar 20, 2026',
      icon: Target,
      color: 'from-green-400 to-emerald-500',
    },
    {
      title: 'Fast Learner',
      description: 'Completed 10 worksheets in one day',
      earned: 'Mar 18, 2026',
      icon: Zap,
      color: 'from-blue-400 to-indigo-500',
    },
    {
      title: 'Perfect Score',
      description: 'Achieved 100% on 5 worksheets',
      earned: 'Mar 15, 2026',
      icon: CheckCircle2,
      color: 'from-purple-400 to-pink-500',
    },
  ];

  const strengths = [
    {
      area: 'Algebra',
      score: 95,
      description: 'Exceptional understanding of algebraic concepts',
    },
    {
      area: 'Grammar',
      score: 93,
      description: 'Strong grasp of English grammar rules',
    },
    {
      area: 'Biology',
      score: 90,
      description: 'Excellent performance in life sciences',
    },
  ];

  const improvements = [
    {
      area: 'Geometry',
      score: 72,
      description: 'Need more practice with spatial reasoning',
      recommendation: 'Complete 5 more geometry worksheets',
    },
    {
      area: 'Chemical Equations',
      score: 75,
      description: 'Balancing equations needs attention',
      recommendation: 'Review chemistry fundamentals',
    },
  ];

  return (
    <AppLayout userRole="student">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/student/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-2">Performance Report</h1>
              <p className="text-muted-foreground">
                Detailed analysis of your learning progress
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Select defaultValue="last-30">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-7">Last 7 Days</SelectItem>
                <SelectItem value="last-30">Last 30 Days</SelectItem>
                <SelectItem value="last-90">Last 90 Days</SelectItem>
                <SelectItem value="all-time">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <Badge variant="secondary" className="bg-green-50 text-green-700">
                +5% up
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">92%</div>
            <p className="text-sm text-muted-foreground">Overall Average</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                This month
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">24</div>
            <p className="text-sm text-muted-foreground">Worksheets Completed</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                7 days
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">15.5h</div>
            <p className="text-sm text-muted-foreground">Total Study Time</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                3 new
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">18</div>
            <p className="text-sm text-muted-foreground">Achievements</p>
          </Card>
        </div>

        {/* Performance Trend */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-1">Performance Trend</h3>
            <p className="text-sm text-muted-foreground">
              Your progress compared to target goals over the last 7 weeks
            </p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={overallTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 5 }}
                name="Your Score"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#94a3b8', r: 4 }}
                name="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Subject Performance */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1">Subject Performance</h3>
              <p className="text-sm text-muted-foreground">
                Detailed breakdown by subject
              </p>
            </div>
            <div className="space-y-6">
              {subjectPerformance.map((subject, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{subject.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {subject.worksheets} worksheets
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold">{subject.score}%</span>
                      <Badge
                        variant="secondary"
                        className="ml-2 bg-green-50 text-green-700"
                      >
                        {subject.improvement}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={subject.score} className="h-2" />
                </div>
              ))}
            </div>
          </Card>

          {/* Skills Radar */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-1">Skills Assessment</h3>
              <p className="text-sm text-muted-foreground">
                Your performance across key learning skills
              </p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={skillsRadar}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="skill"
                  stroke="#64748b"
                  fontSize={12}
                />
                <PolarRadiusAxis stroke="#64748b" fontSize={12} />
                <Radar
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.4}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Weekly Activity */}
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-1">Weekly Activity</h3>
            <p className="text-sm text-muted-foreground">
              Worksheets completed and time spent each day
            </p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Bar
                dataKey="worksheets"
                fill="#6366f1"
                radius={[8, 8, 0, 0]}
                name="Worksheets"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Achievements */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Recent Achievements</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {achievements.map((achievement, index) => {
              const Icon = achievement.icon;
              return (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${achievement.color} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{achievement.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {achievement.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Earned {achievement.earned}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Strengths */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Your Strengths
            </h3>
            <div className="space-y-4">
              {strengths.map((strength, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-green-50 border border-green-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{strength.area}</h4>
                    <Badge className="bg-green-600">{strength.score}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {strength.description}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Areas for Improvement */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-600" />
              Areas for Improvement
            </h3>
            <div className="space-y-4">
              {improvements.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-orange-50 border border-orange-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{item.area}</h4>
                    <Badge variant="outline" className="border-orange-300">
                      {item.score}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.description}
                  </p>
                  <div className="flex items-start gap-2 mt-3 p-2 rounded bg-white">
                    <Target className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs font-medium">{item.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
