/**
 * Tests for MermaidGenerator
 *
 * Tests the simplified MermaidGenerator that delegates to bd CLI
 */

import { describe, it, expect, beforeEach, vi } from 'bun:test';
import { MermaidGenerator } from '../../src/diagrams/mermaid-generator.js';
import type { BeadsClient } from '../../src/clients/beads-client.js';

describe('MermaidGenerator', () => {
  let generator: MermaidGenerator;
  let mockBeads: any;
  let mockBdCli: any;

  beforeEach(() => {
    mockBdCli = {
      exec: vi.fn()
    };

    mockBeads = {
      getBdCli: vi.fn().mockReturnValue(mockBdCli)
    };

    generator = new MermaidGenerator(mockBeads as BeadsClient);
  });

  describe('generate', () => {
    it('should call bd dep tree with correct arguments', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Test Epic"]
  task-1["☑ task-1: Task 1"]
  epic-1 --> task-1`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generate('epic-1');

      expect(mockBeads.getBdCli).toHaveBeenCalled();
      expect(mockBdCli.exec).toHaveBeenCalledWith([
        'dep',
        'tree',
        'epic-1',
        '--format',
        'mermaid',
        '--direction=up',
        '--show-all-paths'
      ]);
      expect(result).toContain(mockMermaidOutput);
    });

    it('should include live dashboard colors via init directive', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Test Epic"]
  task-1["☑ task-1: Task 1"]
  epic-1 --> task-1`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generate('epic-1');

      // Verify init directive with theme variables is present
      expect(result).toContain("%%{init: {");
      expect(result).toContain("'theme': 'base'");
      expect(result).toContain("'primaryColor': '#d4edda'");
      expect(result).toContain("'secondaryColor': '#cce5ff'");
      expect(result).toContain("'tertiaryColor': '#f8d7da'");
    });

    it('should position init directive BEFORE graph definition', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Test Epic"]
  task-1["☑ task-1: Task 1"]
  epic-1 --> task-1`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generate('epic-1');

      // Find positions of init directive and flowchart
      const initPos = result.indexOf('%%{init:');
      const flowchartPos = result.indexOf('flowchart TD');

      // Init directive must appear before flowchart
      expect(initPos).toBeGreaterThanOrEqual(0);
      expect(flowchartPos).toBeGreaterThan(0);
      expect(initPos).toBeLessThan(flowchartPos);
    });

    it('should apply max depth when maxNodes is specified', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: 'flowchart TD\n  node["test"]' });

      await generator.generate('epic-1', { maxNodes: 10 });

      expect(mockBdCli.exec).toHaveBeenCalledWith([
        'dep',
        'tree',
        'epic-1',
        '--format',
        'mermaid',
        '--direction=up',
        '--show-all-paths',
        '--max-depth',
        '2' // log(10) / log(3) ≈ 2.09 -> floor = 2
      ]);
    });

    it('should not apply max depth for default maxNodes', async () => {
      mockBdCli.exec.mockResolvedValue({ stdout: 'flowchart TD\n  node["test"]' });

      await generator.generate('epic-1', { maxNodes: 50 });

      const callArgs = mockBdCli.exec.mock.calls[0][0];
      expect(callArgs).not.toContain('--max-depth');
    });
  });

  describe('generateFromTree', () => {
    it('should return mermaid and node count', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Test Epic"]
  task-1["☑ task-1: Task 1"]
  task-2["☐ task-2: Task 2"]

  epic-1 --> task-1
  epic-1 --> task-2`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generateFromTree('epic-1');

      expect(result.mermaid).toContain(mockMermaidOutput);
      expect(result.nodeCount).toBe(3); // epic-1, task-1, task-2
    });

    it('should include live dashboard colors via init directive in generateFromTree', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Test Epic"]
  task-1["☑ task-1: Task 1"]
  epic-1 --> task-1`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generateFromTree('epic-1');

      // Verify init directive with theme variables is present
      expect(result.mermaid).toContain("%%{init: {");
      expect(result.mermaid).toContain("'theme': 'base'");
      expect(result.mermaid).toContain("'primaryColor': '#d4edda'");
    });

    it('should count nodes correctly with complex diagram', async () => {
      const mockMermaidOutput = `flowchart TD
  epic-1["☐ epic-1: Epic"]
  task-1["☐ task-1: Task 1"]
  task-2["☐ task-2: Task 2"]
  task-3["☐ task-3: Task 3"]
  subtask-1["☐ subtask-1: Subtask"]

  epic-1 --> task-1
  epic-1 --> task-2
  epic-1 --> task-3
  task-1 --> subtask-1`;

      mockBdCli.exec.mockResolvedValue({ stdout: mockMermaidOutput });

      const result = await generator.generateFromTree('epic-1');

      expect(result.nodeCount).toBe(5);
    });
  });

  describe('render', () => {
    it('should wrap mermaid in code fence', () => {
      const mermaid = `flowchart TD
  node["Test"]`;

      const rendered = generator.render(mermaid);

      expect(rendered).toBe('```mermaid\n' + mermaid + '\n```');
    });

    it('should handle empty mermaid', () => {
      const rendered = generator.render('');

      expect(rendered).toBe('```mermaid\n\n```');
    });

    it('should preserve multiline mermaid', () => {
      const mermaid = `flowchart TD
  a["A"]
  b["B"]
  a --> b`;

      const rendered = generator.render(mermaid);

      expect(rendered).toContain('flowchart TD');
      expect(rendered).toContain('a["A"]');
      expect(rendered).toContain('a --> b');
      expect(rendered).toMatch(/^```mermaid\n/);
      expect(rendered).toMatch(/\n```$/);
    });
  });
});
