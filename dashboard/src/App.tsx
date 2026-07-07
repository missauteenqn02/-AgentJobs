import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type JobState = string;

interface JobEvent {
  state: JobState;
  timestamp: number;
  actor: string;
  details?: any;
}

interface Job {
  id: string;
  currentState: JobState;
  events: JobEvent[];
}

function App() {
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const [taskText, setTaskText] = useState('Translate this paragraph into French');
  const [taskType, setTaskType] = useState('translation');
  const [budget, setBudget] = useState('5.0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'JOB_UPDATE') {
        const job = data.job;
        setJobs(prev => {
          const newJobs = new Map(prev);
          newJobs.set(job.id, job);
          return newJobs;
        });
      }
    };
    return () => ws.close();
  }, []);

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: taskText,
          type: taskType,
          maxBudget: parseFloat(budget)
        })
      });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getStatusIcon = (state: string) => {
    if (state === 'COMPLETED') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (state === 'DISPUTED' || state === 'REFUNDED') return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
            AgentJobs Autonomous Network
          </h1>
          <p className="text-slate-400">Zero-click autonomous delegation powered by Unicity Sphere</p>
        </header>

        <section className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <form onSubmit={submitTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-1">Task Description</label>
                <input
                  type="text"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Translate to French"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Service Type</label>
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="translation">Translation</option>
                  <option value="summarization">Summarization</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 items-end">
              <div className="w-48">
                <label className="block text-sm font-medium text-slate-400 mb-1">Max Budget (UCT)</label>
                <input
                  type="number"
                  step="0.1"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                {loading ? 'Submitting...' : 'Dispatch Boss Agent'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-200">Live Activity Feed</h2>
          
          <div className="space-y-6">
            <AnimatePresence>
              {Array.from(jobs.values()).reverse().map(job => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
                >
                  <div className="bg-slate-750 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.currentState)}
                      <span className="font-medium text-lg">Job: {job.id}</span>
                    </div>
                    <span className="px-3 py-1 bg-slate-900 rounded-full text-sm text-slate-300 font-mono">
                      {job.currentState}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {job.events.map((ev, i) => (
                      <div key={i} className="flex gap-4 text-sm">
                        <span className="text-slate-500 font-mono shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold text-blue-400 shrink-0 w-24">
                          [{ev.actor}]
                        </span>
                        <span className="text-slate-300">
                          Transited to <span className="text-white font-medium">{ev.state}</span>
                          {ev.details && (
                            <pre className="mt-2 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-slate-400 overflow-x-auto">
                              {JSON.stringify(ev.details, null, 2)}
                            </pre>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {jobs.size === 0 && (
              <div className="text-center text-slate-500 py-12">
                No jobs submitted yet. Start by dispatching a task above.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
