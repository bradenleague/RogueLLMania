/**
 * Benchmark system for tracking LLM generation quality over time
 * 
 * This allows you to:
 * 1. Run generations against test prompts
 * 2. Score the outputs
 * 3. Store results with timestamps
 * 4. Compare against baselines
 * 5. Track improvements/regressions
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { QualityMetrics, PerformanceTimer } from './testHelpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = join(__dirname, '../benchmarks');
const RESULTS_FILE = join(BENCHMARK_DIR, 'benchmark-results.json');

/**
 * Benchmark runner for LLM generations
 */
export class BenchmarkRunner {
  constructor() {
    this.results = this.loadResults();
  }

  /**
   * Load historical benchmark results
   */
  loadResults() {
    if (existsSync(RESULTS_FILE)) {
      try {
        const data = readFileSync(RESULTS_FILE, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load benchmark results:', error.message);
        return { runs: [], baseline: null };
      }
    }
    return { runs: [], baseline: null };
  }

  /**
   * Save benchmark results
   */
  saveResults() {
    try {
      writeFileSync(RESULTS_FILE, JSON.stringify(this.results, null, 2));
    } catch (error) {
      console.error('Failed to save benchmark results:', error.message);
    }
  }

  /**
   * Run a benchmark test
   */
  async runBenchmark(name, testFn, context = {}) {
    const timer = new PerformanceTimer();
    const timestamp = new Date().toISOString();
    
    console.log(`\n🔬 Running benchmark: ${name}`);
    
    timer.start();
    let output, error;
    
    try {
      output = await testFn();
    } catch (err) {
      error = err.message;
      console.error('❌ Benchmark failed:', err.message);
    }
    
    const duration = timer.end(name);
    
    if (!output) {
      return {
        name,
        timestamp,
        error,
        duration,
        status: 'failed'
      };
    }

    // Evaluate quality
    const quality = QualityMetrics.evaluateOverallQuality(output, context);
    
    const result = {
      name,
      timestamp,
      duration,
      output: output.substring(0, 500), // Store first 500 chars
      outputLength: output.length,
      quality: {
        score: quality.overallScore,
        metrics: quality.metrics,
        passed: quality.passed
      },
      context,
      status: quality.passed ? 'passed' : 'failed'
    };

    // Store result
    this.results.runs.push(result);
    this.saveResults();

    // Display results
    this.displayResult(result);

    return result;
  }

  /**
   * Display benchmark result
   */
  displayResult(result) {
    const statusIcon = result.status === 'passed' ? '✅' : '❌';
    const scorePercent = (result.quality?.score * 100 || 0).toFixed(1);
    
    console.log(`${statusIcon} ${result.name}`);
    console.log(`   Quality Score: ${scorePercent}%`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Output Length: ${result.outputLength} chars`);
    
    if (result.quality?.metrics) {
      console.log('   Metrics:');
      for (const [key, value] of Object.entries(result.quality.metrics)) {
        const icon = value.valid ? '✓' : '✗';
        console.log(`     ${icon} ${key}`);
      }
    }
  }

  /**
   * Set baseline from current run
   */
  setBaseline(runIndex = -1) {
    const run = runIndex === -1 
      ? this.results.runs[this.results.runs.length - 1]
      : this.results.runs[runIndex];
    
    if (!run) {
      console.error('No run found to set as baseline');
      return;
    }

    this.results.baseline = {
      name: run.name,
      timestamp: run.timestamp,
      score: run.quality.score,
      duration: run.duration
    };
    
    this.saveResults();
    console.log('✅ Baseline set:', this.results.baseline);
  }

  /**
   * Compare current results to baseline
   */
  compareToBaseline() {
    if (!this.results.baseline) {
      console.log('⚠️  No baseline set. Run setBaseline() first.');
      return null;
    }

    if (this.results.runs.length === 0) {
      console.log('⚠️  No runs to compare.');
      return null;
    }

    const latestRun = this.results.runs[this.results.runs.length - 1];
    const baseline = this.results.baseline;

    const scoreChange = latestRun.quality.score - baseline.score;
    const durationChange = latestRun.duration - baseline.duration;

    const comparison = {
      baseline: baseline,
      current: {
        name: latestRun.name,
        timestamp: latestRun.timestamp,
        score: latestRun.quality.score,
        duration: latestRun.duration
      },
      changes: {
        score: scoreChange,
        scorePercent: (scoreChange / baseline.score) * 100,
        duration: durationChange,
        durationPercent: (durationChange / baseline.duration) * 100
      },
      improved: scoreChange > 0,
      faster: durationChange < 0
    };

    console.log('\n📊 Comparison to Baseline:');
    console.log(`   Baseline: ${baseline.name} (${baseline.timestamp})`);
    console.log(`   Current:  ${latestRun.name} (${latestRun.timestamp})`);
    console.log(`   Quality: ${baseline.score.toFixed(3)} → ${latestRun.quality.score.toFixed(3)} (${comparison.changes.scorePercent > 0 ? '+' : ''}${comparison.changes.scorePercent.toFixed(1)}%)`);
    console.log(`   Speed:   ${baseline.duration}ms → ${latestRun.duration}ms (${comparison.changes.durationPercent > 0 ? '+' : ''}${comparison.changes.durationPercent.toFixed(1)}%)`);
    
    if (comparison.improved) {
      console.log('   ✅ Quality improved!');
    } else if (scoreChange < 0) {
      console.log('   ⚠️  Quality regressed');
    } else {
      console.log('   ➡️  Quality unchanged');
    }

    return comparison;
  }

  /**
   * Get statistics across all runs
   */
  getStats() {
    if (this.results.runs.length === 0) {
      return null;
    }

    const scores = this.results.runs
      .filter(r => r.quality?.score)
      .map(r => r.quality.score);
    
    const durations = this.results.runs
      .filter(r => r.duration)
      .map(r => r.duration);

    const stats = {
      totalRuns: this.results.runs.length,
      scores: {
        min: Math.min(...scores),
        max: Math.max(...scores),
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
        latest: scores[scores.length - 1]
      },
      durations: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        latest: durations[durations.length - 1]
      },
      passRate: this.results.runs.filter(r => r.status === 'passed').length / this.results.runs.length
    };

    console.log('\n📈 Benchmark Statistics:');
    console.log(`   Total Runs: ${stats.totalRuns}`);
    console.log(`   Pass Rate: ${(stats.passRate * 100).toFixed(1)}%`);
    console.log(`   Quality Score: ${stats.scores.avg.toFixed(3)} (min: ${stats.scores.min.toFixed(3)}, max: ${stats.scores.max.toFixed(3)})`);
    console.log(`   Duration: ${stats.durations.avg.toFixed(0)}ms (min: ${stats.durations.min}ms, max: ${stats.durations.max}ms)`);

    return stats;
  }

  /**
   * Clear all results
   */
  clearResults() {
    this.results = { runs: [], baseline: null };
    this.saveResults();
    console.log('✅ Benchmark results cleared');
  }

  /**
   * Export results for analysis
   */
  exportResults(filename = 'benchmark-export.json') {
    const exportPath = join(BENCHMARK_DIR, filename);
    writeFileSync(exportPath, JSON.stringify(this.results, null, 2));
    console.log(`✅ Results exported to ${exportPath}`);
  }
}

/**
 * Create a benchmark suite for testing
 */
export function createBenchmarkSuite(name, tests) {
  return {
    name,
    tests,
    async run(runner) {
      console.log(`\n🎯 Running benchmark suite: ${name}`);
      const results = [];

      for (const test of tests) {
        const result = await runner.runBenchmark(
          `${name}/${test.name}`,
          test.fn,
          test.context
        );
        results.push(result);
      }

      return results;
    }
  };
}
