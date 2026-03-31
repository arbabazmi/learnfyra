import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Sparkles, Plus, Trash2, Save, Eye } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';

export default function CreateWorksheet() {
  const [questions, setQuestions] = useState([
    { id: 1, type: 'mcq', question: '', options: ['', '', '', ''], answer: '' },
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: questions.length + 1,
        type: 'mcq',
        question: '',
        options: ['', '', '', ''],
        answer: '',
      },
    ]);
  };

  const removeQuestion = (id: number) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  return (
    <AppLayout userRole="teacher">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/teacher/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-xl font-semibold">Create New Worksheet</h1>
                  <p className="text-sm text-muted-foreground">
                    Design custom worksheets for your students
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </Button>
                <Button className="gap-2">
                  <Save className="w-4 h-4" />
                  Save & Assign
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-muted/30">
          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Basic Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Worksheet Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Algebra - Linear Equations"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Mathematics</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="social">Social Studies</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((grade) => (
                        <SelectItem key={grade} value={`grade-${grade}`}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty *</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the worksheet..."
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* AI Generation */}
            <Card className="p-6 bg-gradient-to-br from-primary-light to-purple-50 border-primary/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    Generate with AI
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Let AI create questions based on your requirements
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-topic">Topic</Label>
                      <Input id="ai-topic" placeholder="e.g., Quadratic Equations" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-count">Number of Questions</Label>
                      <Input id="ai-count" type="number" placeholder="10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ai-type">Question Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq">Multiple Choice</SelectItem>
                          <SelectItem value="short">Short Answer</SelectItem>
                          <SelectItem value="long">Long Answer</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Generate Questions
                  </Button>
                </div>
              </div>
            </Card>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Questions</h3>
                <Button onClick={addQuestion} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Question
                </Button>
              </div>

              <div className="space-y-6">
                {questions.map((question, index) => (
                  <Card key={question.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant="secondary">Question {index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Question Type</Label>
                          <Select defaultValue="mcq">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mcq">Multiple Choice</SelectItem>
                              <SelectItem value="short">Short Answer</SelectItem>
                              <SelectItem value="long">Long Answer</SelectItem>
                              <SelectItem value="true-false">
                                True/False
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Points</Label>
                          <Input type="number" placeholder="1" defaultValue="1" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Question Text *</Label>
                        <Textarea
                          placeholder="Enter your question here..."
                          rows={3}
                        />
                      </div>

                      {question.type === 'mcq' && (
                        <div className="space-y-3">
                          <Label>Answer Options</Label>
                          {question.options.map((_, optIndex) => (
                            <div key={optIndex} className="flex gap-3">
                              <Input
                                placeholder={`Option ${String.fromCharCode(
                                  65 + optIndex
                                )}`}
                              />
                              <Button variant="outline" size="icon">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 w-full"
                          >
                            <Plus className="w-4 h-4" />
                            Add Option
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Correct Answer *</Label>
                        <Input placeholder="Enter the correct answer" />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Hint (Optional)</Label>
                          <Textarea
                            placeholder="Provide a hint to help students..."
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Explanation (Optional)</Label>
                          <Textarea
                            placeholder="Explain the solution..."
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Settings */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Worksheet Settings</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Time Limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Set a time limit for completing the worksheet
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      placeholder="60"
                      className="w-20"
                      defaultValue="60"
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Hints</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow students to view hints while solving
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Explanations</Label>
                    <p className="text-sm text-muted-foreground">
                      Show explanations after submission
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI Validation</Label>
                    <p className="text-sm text-muted-foreground">
                      Use AI to validate student answers
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Randomize Questions</Label>
                    <p className="text-sm text-muted-foreground">
                      Show questions in random order
                    </p>
                  </div>
                  <Switch />
                </div>
              </div>
            </Card>

            {/* Assign */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Assign to Students</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Class/Group</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class or group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7a">Grade 7A (45 students)</SelectItem>
                      <SelectItem value="7b">Grade 7B (42 students)</SelectItem>
                      <SelectItem value="all-7">All Grade 7 (87 students)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
