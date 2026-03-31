import { useState } from 'react';
import { Link } from 'react-router';
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Circle,
  Play,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export default function WorksheetList() {
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const worksheets = [
    {
      id: 1,
      title: 'Algebra - Linear Equations',
      subject: 'Mathematics',
      grade: '7',
      difficulty: 'Medium',
      status: 'completed',
      score: 92,
      totalQuestions: 25,
      timeSpent: '45 min',
      date: '2 hours ago',
      dueDate: null,
    },
    {
      id: 2,
      title: 'Photosynthesis & Plant Biology',
      subject: 'Science',
      grade: '7',
      difficulty: 'Easy',
      status: 'in-progress',
      progress: 60,
      completedQuestions: 15,
      totalQuestions: 25,
      timeSpent: '28 min',
      date: 'Today',
      dueDate: 'Tomorrow',
    },
    {
      id: 3,
      title: 'Grammar - Active & Passive Voice',
      subject: 'English',
      grade: '7',
      difficulty: 'Hard',
      status: 'not-started',
      totalQuestions: 30,
      estimatedTime: '50 min',
      date: 'Assigned today',
      dueDate: 'In 3 days',
    },
    {
      id: 4,
      title: 'Fractions and Decimals',
      subject: 'Mathematics',
      grade: '7',
      difficulty: 'Easy',
      status: 'completed',
      score: 88,
      totalQuestions: 20,
      timeSpent: '32 min',
      date: 'Yesterday',
      dueDate: null,
    },
    {
      id: 5,
      title: 'World War II History',
      subject: 'Social Studies',
      grade: '7',
      difficulty: 'Medium',
      status: 'not-started',
      totalQuestions: 35,
      estimatedTime: '60 min',
      date: '2 days ago',
      dueDate: 'In 5 days',
    },
    {
      id: 6,
      title: 'Chemical Reactions',
      subject: 'Science',
      grade: '7',
      difficulty: 'Hard',
      status: 'completed',
      score: 85,
      totalQuestions: 28,
      timeSpent: '52 min',
      date: '3 days ago',
      dueDate: null,
    },
  ];

  const filteredWorksheets = worksheets.filter((worksheet) => {
    const matchesSubject =
      selectedSubject === 'all' || worksheet.subject === selectedSubject;
    const matchesSearch =
      searchQuery === '' ||
      worksheet.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  const completedWorksheets = filteredWorksheets.filter(
    (w) => w.status === 'completed'
  );
  const inProgressWorksheets = filteredWorksheets.filter(
    (w) => w.status === 'in-progress'
  );
  const notStartedWorksheets = filteredWorksheets.filter(
    (w) => w.status === 'not-started'
  );

  const WorksheetCard = ({ worksheet }: { worksheet: any }) => (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                worksheet.status === 'completed'
                  ? 'bg-green-100'
                  : worksheet.status === 'in-progress'
                  ? 'bg-blue-100'
                  : 'bg-gray-100'
              }`}
            >
              {worksheet.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : worksheet.status === 'in-progress' ? (
                <Play className="w-6 h-6 text-blue-600" />
              ) : (
                <Circle className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{worksheet.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{worksheet.subject}</span>
                <span>•</span>
                <span>Grade {worksheet.grade}</span>
                <span>•</span>
                <Badge
                  variant="outline"
                  className={
                    worksheet.difficulty === 'Easy'
                      ? 'border-green-300 text-green-700'
                      : worksheet.difficulty === 'Medium'
                      ? 'border-orange-300 text-orange-700'
                      : 'border-red-300 text-red-700'
                  }
                >
                  {worksheet.difficulty}
                </Badge>
                {worksheet.dueDate && (
                  <>
                    <span>•</span>
                    <span className="text-orange-600 font-medium">
                      Due: {worksheet.dueDate}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {worksheet.status === 'completed' && (
            <div className="flex items-center gap-6 ml-15 text-sm">
              <div>
                <span className="text-muted-foreground">Score: </span>
                <span className="font-semibold text-green-600">
                  {worksheet.score}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Questions: </span>
                <span className="font-medium">{worksheet.totalQuestions}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time: </span>
                <span className="font-medium">{worksheet.timeSpent}</span>
              </div>
            </div>
          )}

          {worksheet.status === 'in-progress' && (
            <div className="ml-15 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {worksheet.completedQuestions} of {worksheet.totalQuestions}{' '}
                  completed
                </span>
                <span className="font-medium">{worksheet.progress}%</span>
              </div>
              <Progress value={worksheet.progress} className="h-2" />
            </div>
          )}

          {worksheet.status === 'not-started' && (
            <div className="flex items-center gap-6 ml-15 text-sm text-muted-foreground">
              <div>
                <span>Questions: </span>
                <span className="font-medium text-foreground">
                  {worksheet.totalQuestions}
                </span>
              </div>
              <div>
                <span>Est. Time: </span>
                <span className="font-medium text-foreground">
                  {worksheet.estimatedTime}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 lg:flex-col lg:items-end">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {worksheet.date}
          </span>
          <Link to={`/student/worksheet/${worksheet.id}`}>
            <Button
              className={
                worksheet.status === 'completed'
                  ? 'bg-green-600 hover:bg-green-700'
                  : worksheet.status === 'in-progress'
                  ? ''
                  : 'bg-gray-600 hover:bg-gray-700'
              }
            >
              {worksheet.status === 'completed'
                ? 'Review'
                : worksheet.status === 'in-progress'
                ? 'Continue'
                : 'Start'}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );

  return (
    <AppLayout userRole="student">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Worksheets</h1>
            <p className="text-muted-foreground">
              Manage and track all your assigned worksheets
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="gap-2">
              <SlidersHorizontal className="w-5 h-5" />
              Filters
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {completedWorksheets.length}
                </div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {inProgressWorksheets.length}
                </div>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {notStartedWorksheets.length}
                </div>
                <p className="text-sm text-muted-foreground">Not Started</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search worksheets..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Mathematics">Mathematics</SelectItem>
              <SelectItem value="Science">Science</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Social Studies">Social Studies</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Worksheets Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="all">
              All ({filteredWorksheets.length})
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              In Progress ({inProgressWorksheets.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedWorksheets.length})
            </TabsTrigger>
            <TabsTrigger value="not-started">
              Not Started ({notStartedWorksheets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredWorksheets.length === 0 ? (
              <Card className="p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No worksheets found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </Card>
            ) : (
              filteredWorksheets.map((worksheet) => (
                <WorksheetCard key={worksheet.id} worksheet={worksheet} />
              ))
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4">
            {inProgressWorksheets.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  No worksheets in progress
                </h3>
                <p className="text-muted-foreground">
                  Start a new worksheet to see it here
                </p>
              </Card>
            ) : (
              inProgressWorksheets.map((worksheet) => (
                <WorksheetCard key={worksheet.id} worksheet={worksheet} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedWorksheets.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  No completed worksheets yet
                </h3>
                <p className="text-muted-foreground">
                  Complete your first worksheet to see it here
                </p>
              </Card>
            ) : (
              completedWorksheets.map((worksheet) => (
                <WorksheetCard key={worksheet.id} worksheet={worksheet} />
              ))
            )}
          </TabsContent>

          <TabsContent value="not-started" className="space-y-4">
            {notStartedWorksheets.length === 0 ? (
              <Card className="p-12 text-center">
                <Circle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  All caught up!
                </h3>
                <p className="text-muted-foreground">
                  You've started all your assigned worksheets
                </p>
              </Card>
            ) : (
              notStartedWorksheets.map((worksheet) => (
                <WorksheetCard key={worksheet.id} worksheet={worksheet} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
