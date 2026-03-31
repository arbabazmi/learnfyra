import { useState } from 'react';
import { Link } from 'react-router';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
  Lightbulb,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Send,
  BookOpen,
  Flag,
} from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';

export default function WorksheetSolve() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAIHelp, setShowAIHelp] = useState(false);

  const worksheet = {
    title: 'Algebra - Linear Equations',
    subject: 'Mathematics',
    grade: '7',
    difficulty: 'Medium',
    totalQuestions: 25,
    timeLimit: 50,
  };

  const questions = [
    {
      id: 1,
      question: 'Solve for x: 3x + 7 = 22',
      type: 'input',
      options: [],
      hint: 'Subtract 7 from both sides first, then divide by 3',
      explanation:
        'Step 1: 3x + 7 - 7 = 22 - 7 → 3x = 15\nStep 2: 3x ÷ 3 = 15 ÷ 3 → x = 5',
      correctAnswer: '5',
      status: 'current',
    },
    {
      id: 2,
      question: 'If 2y - 5 = 11, what is the value of y?',
      type: 'mcq',
      options: ['6', '7', '8', '9'],
      hint: 'Add 5 to both sides, then divide by 2',
      explanation: 'Add 5: 2y = 16, then divide: y = 8',
      correctAnswer: '8',
      status: 'unanswered',
    },
    {
      id: 3,
      question: 'Simplify: 4(x + 3) - 2x',
      type: 'mcq',
      options: ['2x + 12', '2x + 3', '6x + 12', '6x + 3'],
      hint: 'Distribute 4 to both terms inside the parentheses first',
      explanation:
        'Distribute: 4x + 12 - 2x\nCombine like terms: 2x + 12',
      correctAnswer: '2x + 12',
      status: 'unanswered',
    },
  ];

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / worksheet.totalQuestions) * 100;

  return (
    <AppLayout userRole="student">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <Link to="/student/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">38:24</span>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Flag className="w-4 h-4" />
                  Save & Exit
                </Button>
              </div>
            </div>

            <div>
              <h1 className="text-xl font-semibold mb-2">{worksheet.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                <span>{worksheet.subject}</span>
                <span>•</span>
                <span>Grade {worksheet.grade}</span>
                <span>•</span>
                <Badge variant="outline">{worksheet.difficulty}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progress} className="flex-1 h-2" />
                <span className="text-sm font-medium whitespace-nowrap">
                  {currentQuestion + 1} of {worksheet.totalQuestions}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Question Panel */}
              <Card className="lg:col-span-2 p-8">
                <div className="mb-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                      {currentQuestion + 1}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold leading-relaxed">
                        {question.question}
                      </h2>
                    </div>
                  </div>

                  {question.type === 'mcq' && (
                    <div className="space-y-3">
                      {question.options.map((option, index) => (
                        <button
                          key={index}
                          className="w-full p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary-light transition-all text-left flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full border-2 border-muted-foreground flex items-center justify-center font-medium">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="font-medium">{option}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {question.type === 'input' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Your Answer:
                        </label>
                        <Textarea
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          placeholder="Type your answer here..."
                          className="min-h-[120px] text-base resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Hint Section */}
                {showHint && (
                  <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Hint</h4>
                        <p className="text-sm text-blue-800">{question.hint}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation Section */}
                {showExplanation && (
                  <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-start gap-3">
                      <BookOpen className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-green-900 mb-1">
                          Explanation
                        </h4>
                        <p className="text-sm text-green-800 whitespace-pre-line">
                          {question.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowHint(!showHint)}
                  >
                    <Lightbulb className="w-4 h-4" />
                    {showHint ? 'Hide' : 'Show'} Hint
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowExplanation(!showExplanation)}
                  >
                    <BookOpen className="w-4 h-4" />
                    {showExplanation ? 'Hide' : 'Show'} Explanation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowAIHelp(!showAIHelp)}
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask AI
                  </Button>
                </div>

                {/* AI Help Section */}
                {showAIHelp && (
                  <div className="mt-6 p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-900 mb-1">
                          AI Assistant
                        </h4>
                        <p className="text-sm text-purple-800">
                          I can help you understand this problem step by step. What
                          part would you like me to explain?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Ask me anything about this question..."
                        className="flex-1 min-h-[80px] bg-white resize-none"
                      />
                      <Button size="icon" className="self-end">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={currentQuestion === 0}
                    onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => {
                      if (currentQuestion < questions.length - 1) {
                        setCurrentQuestion(currentQuestion + 1);
                        setShowHint(false);
                        setShowExplanation(false);
                        setShowAIHelp(false);
                        setUserAnswer('');
                      }
                    }}
                  >
                    {currentQuestion === questions.length - 1 ? 'Submit' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Question Navigator */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Questions</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: worksheet.totalQuestions }).map((_, i) => {
                      const isAnswered = i < currentQuestion;
                      const isCurrent = i === currentQuestion;
                      return (
                        <button
                          key={i}
                          className={`aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-medium transition-all ${
                            isCurrent
                              ? 'border-primary bg-primary text-primary-foreground'
                              : isAnswered
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-border hover:border-muted-foreground'
                          }`}
                          onClick={() => setCurrentQuestion(i)}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-muted-foreground">Answered</span>
                      </div>
                      <span className="font-medium">{currentQuestion}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Circle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Not Answered</span>
                      </div>
                      <span className="font-medium">
                        {worksheet.totalQuestions - currentQuestion}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Tips */}
                <Card className="p-6 bg-gradient-to-br from-primary-light to-purple-50">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Quick Tip</h4>
                      <p className="text-sm text-muted-foreground">
                        Use the hint feature if you're stuck. It won't affect your
                        score!
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
