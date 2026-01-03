# Prompt Engineering Guide for RogueLLMania Narration

This guide provides strategies for improving LLM-generated narration quality in RogueLLMania.

## 🎯 Overview

RogueLLMania uses LLMs to generate two types of narration:
1. **Level Introductions** (Chamber Herald) - Set the scene when entering a new chamber
2. **Artifact Descriptions** (Archivist) - Create lore for mysterious artifacts

## 📍 Key Prompt Files

- **Level Introductions**: `src/systems/levelIntroduction.js` (lines 31-51: STATIC_PROMPT)
- **Artifact Descriptions**: `src/entities/storyObject.js` (lines 25-53: STATIC_PROMPT)

## 🔧 Improvement Workflow

### 1. Identify Issues

Run tests to find quality issues:

```bash
npm test
```

Check specific metrics:
- Length (too short/long?)
- Clean output (XML tags leaking?)
- Atmospheric language (too generic?)
- Context integration (missing key elements?)
- Clichés (overused phrases?)

### 2. Test Changes with Benchmarks

Before modifying production prompts, test changes:

```bash
# Edit tests/fixtures/goldenOutputs.js TEST_PROMPTS
# Then run benchmark
npm run benchmark
```

### 3. Apply to Production

If benchmark shows improvement:
1. Update the actual prompt in source files
2. Run tests to verify: `npm test`
3. Test in-game manually
4. Set new baseline: `node -e "import('./tests/llm/runBenchmark.js').then(m => m.runner.setBaseline())"`

## 📝 Prompt Engineering Techniques

### Technique 1: Constrain Output Format

**Problem**: LLM includes extra text, tags, or formatting

**Solution**: Be explicit about output format

```javascript
// Before
"Write a description of the chamber."

// After
"Return only this structure (no extra text):
<output_format>
  <description>…</description>
</output_format>"
```

### Technique 2: Use Examples

**Problem**: LLM output is too generic or inconsistent

**Solution**: Provide concrete examples

```javascript
const STATIC_PROMPT = `
...
Examples (tone only, do not mimic content):
<example>
  <title>Whispering Root</title>
  <description>A length of petrified root, veined with brittle crystal...</description>
</example>
`;
```

### Technique 3: Negative Constraints

**Problem**: LLM uses clichés or unwanted patterns

**Solution**: Explicitly forbid them

```javascript
"Avoid phrases like:
- 'in the heart of'
- 'it should be noted'
- 'at the end of the day'
Never contradict the tags; do not introduce new entities..."
```

### Technique 4: Reasoning Steps

**Problem**: LLM ignores context or misses details

**Solution**: Add a reasoning checklist

```javascript
"### Reasoning checklist
1. Read every incoming XML tag and remember its values.
2. Weave the following ingredients into the prose:
   • <floor> and <chamber_type>
   • A sense of threat using <monster_count>
3. Write in second person..."
```

### Technique 5: Length Constraints

**Problem**: Output is too short or too long

**Solution**: Specify exact requirements

```javascript
"Length: 20–80 words in 1–2 sentences, varied rhythm."
```

## 🎨 Style Guidelines

### For Level Introductions

**Good Elements:**
- Second person ("You step into...")
- Sensory details (sight, sound, smell)
- Atmospheric words (shadow, echo, ancient)
- Threat implied, not stated directly
- 2-3 sentences, 20-100 words

**Bad Elements:**
- Third person narration
- Literal monster names ("You see 3 zombies")
- Generic descriptions ("You enter a room")
- Info-dump format
- Tags or code visible

### For Artifact Descriptions

**Good Elements:**
- Vivid material descriptions
- Environmental integration
- Power hints (subtle, evocative)
- Sensory details (texture, temperature, light)
- 1-2 sentences, 20-80 words

**Bad Elements:**
- Listing format ("Material: X, Form: Y")
- Copied XML values verbatim
- Generic "mysterious object" phrasing
- No connection to surroundings
- Power stated literally

## 🐛 Common Issues and Fixes

### Issue: XML Tags Appearing in Output

**Fix**: Improve tag stripping in sanitization functions

### Issue: Generic, Repetitive Descriptions

**Fix**: Add more varied examples, increase temperature, or expand context

### Issue: Context Not Integrated

**Fix**: Make reasoning steps more explicit, add examples showing integration

### Issue: Too Slow

**Fix**: Reduce maxTokens, simplify prompt, use faster model, or enable GPU

## 📊 Measuring Success

### Quality Score Targets

- **Excellent**: 0.9+ (all metrics pass)
- **Good**: 0.7-0.9 (most metrics pass)
- **Needs Work**: < 0.7

## 🔄 Iteration Cycle

1. **Identify** issue (tests, player feedback)
2. **Hypothesize** fix (prompt change)
3. **Test** with benchmarks
4. **Apply** if improved
5. **Verify** with manual testing
6. **Document** what worked
7. **Baseline** for future comparison

Remember: Small, incremental changes are easier to test and validate than large rewrites!
