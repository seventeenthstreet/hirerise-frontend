// lib/avaEmotionEngine.ts
//
// Ava Personality & Emotion Engine
//
// Pure functions — no side effects, no imports, fully testable.
// Used by AvaProactiveBanner, AvaCoachingSystem, and AvaMemoryCard.
//
// Emotion hierarchy (highest priority first):
//   celebration → something good just happened
//   urgency     → close to goal, push them over the line
//   nudge       → inactive, gently re-engage
//   encouraging → default forward-momentum tone

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvaEmotion = 'celebration' | 'urgency' | 'nudge' | 'encouraging';

export interface AvaEmotionState {
  progressDelta:   number;   // score change since last week (positive = good)
  lastActiveDays:  number;   // days since last platform activity
  currentScore:    number;   // 0–100
  targetScore:     number;   // milestone they're working toward
  stepsCompleted:  number;   // coaching steps done this session
}

export interface AvaEmotionResult {
  emotion:     AvaEmotion;
  intensity:   'low' | 'medium' | 'high';  // scales emoji/copy energy
  color:       string;                      // hex accent for the UI
  emoji:       string;                      // primary emoji for this state
  label:       string;                      // short human label
}

export interface AvaMessageContext {
  emotion:        AvaEmotion;
  firstName:      string;
  currentScore:   number;
  targetScore:    number;
  progressDelta:  number;
  stepsCompleted: number;
  totalSteps:     number;
  missingSkills:  number;
  targetRole:     string | null;
  // Which surface is rendering the message
  surface:        'banner' | 'coaching' | 'memory';
}

// ─── Emotion engine ───────────────────────────────────────────────────────────

/**
 * getAvaEmotion(userState)
 *
 * Determines Ava's emotional state from user behaviour signals.
 * Returns a full EmotionResult with color, emoji, and intensity — ready for UI use.
 */
export function getAvaEmotion(state: AvaEmotionState): AvaEmotionResult {
  const { progressDelta, lastActiveDays, currentScore, targetScore, stepsCompleted } = state;
  const gap = targetScore - currentScore;

  // ── Celebration: meaningful positive progress ──────────────────────────────
  if (progressDelta >= 8 || stepsCompleted >= 2) {
    return {
      emotion:   'celebration',
      intensity: progressDelta >= 15 ? 'high' : progressDelta >= 8 ? 'medium' : 'low',
      color:     '#1fd8a0',   // green
      emoji:     progressDelta >= 15 ? '🎉' : '✨',
      label:     'Great progress',
    };
  }

  // ── Nudge: inactive for 3+ days — re-engagement priority ──────────────────
  if (lastActiveDays >= 3) {
    const intensity = lastActiveDays >= 7 ? 'high' : lastActiveDays >= 5 ? 'medium' : 'low';
    return {
      emotion:   'nudge',
      intensity,
      color:     '#9b7cf7',   // purple
      emoji:     lastActiveDays >= 7 ? '👋' : '💭',
      label:     'We miss you',
    };
  }

  // ── Urgency: within striking distance of their goal ───────────────────────
  if (gap <= 10 && gap > 0) {
    return {
      emotion:   'urgency',
      intensity: gap <= 5 ? 'high' : 'medium',
      color:     '#f4a928',   // amber
      emoji:     '🎯',
      label:     'So close',
    };
  }

  // ── Encouraging: default forward-momentum tone ─────────────────────────────
  return {
    emotion:   'encouraging',
    intensity: currentScore >= 50 ? 'medium' : 'low',
    color:     '#3c72f8',   // blue
    emoji:     currentScore >= 50 ? '💪' : '🚀',
    label:     'Keep going',
  };
}

// ─── Message generator ────────────────────────────────────────────────────────

/**
 * generateAvaMessage(context)
 *
 * Returns a tone-matched, personalised string for a given surface.
 * Short sentences. Action-oriented. Includes name + stats where natural.
 * Never generic — every branch uses real data.
 */
export function generateAvaMessage(ctx: AvaMessageContext): string {
  const { emotion, firstName, currentScore, targetScore, progressDelta,
          stepsCompleted, totalSteps, missingSkills, targetRole, surface } = ctx;
  const name       = firstName || 'there';
  const gap        = Math.max(0, targetScore - currentScore);
  const roleStr    = targetRole ? ` for ${targetRole}` : '';
  const remaining  = totalSteps - stepsCompleted;

  switch (emotion) {

    // ── Celebration ──────────────────────────────────────────────────────────
    case 'celebration': {
      if (surface === 'banner') {
        if (progressDelta >= 15)
          return `${name}, you've jumped ${progressDelta} pts this week ✨ That's a serious leap. Keep it up and you'll hit ${targetScore}% before you know it.`;
        if (stepsCompleted >= 2)
          return `Nice work, ${name} — you've completed ${stepsCompleted} steps already 🎉 You're building real momentum here.`;
        return `You're improving, ${name} ✨ Your score moved up ${progressDelta} pts. Small wins compound fast.`;
      }
      if (surface === 'coaching') {
        if (stepsCompleted >= totalSteps - 1)
          return `Almost there${roleStr} 🎉 Just ${remaining} step${remaining > 1 ? 's' : ''} to go. You're so close.`;
        return `${stepsCompleted} of ${totalSteps} steps done ✨ Great work — your next step will push you even further.`;
      }
      // memory
      return `You gained ${progressDelta} pts last week, ${name} ✨ That's real progress. Keep this pace and you'll reach ${targetScore}% within the week.`;
    }

    // ── Urgency ───────────────────────────────────────────────────────────────
    case 'urgency': {
      if (surface === 'banner') {
        if (gap <= 5)
          return `${name}, you're only ${gap} pts away from ${targetScore}%${roleStr} 🎯 One small action gets you there today.`;
        return `You're ${gap} pts from ${targetScore}%${roleStr} 🎯 This is the closest you've been — don't stop now.`;
      }
      if (surface === 'coaching') {
        return `${gap} pts stand between you and your goal 🎯 Complete this step and watch your score jump.`;
      }
      // memory
      return `You're ${gap} pts from ${targetScore}%${roleStr} 🎯 You're so close — one focused session today could get you there.`;
    }

    // ── Nudge ─────────────────────────────────────────────────────────────────
    case 'nudge': {
      if (surface === 'banner') {
        return `Hey ${name} 👋 Your career profile hasn't been updated in a few days. The market doesn't pause — a quick check-in keeps you ahead.`;
      }
      if (surface === 'coaching') {
        return `Your coaching plan is waiting 💭 Pick up where you left off — it only takes a few minutes to make progress.`;
      }
      // memory
      return `We haven't seen you in a bit, ${name} 👋 Your recommendations are ready and waiting. Jump back in — it's worth it.`;
    }

    // ── Encouraging (default) ─────────────────────────────────────────────────
    case 'encouraging':
    default: {
      if (surface === 'banner') {
        if (missingSkills > 0)
          return `${name}, adding ${Math.min(missingSkills, 3)} skill${missingSkills > 1 ? 's' : ''} will boost your match score significantly 🚀 Each one brings you closer${roleStr}.`;
        if (currentScore < 50)
          return `Every step counts, ${name} 🚀 Your score is at ${currentScore}% — the fastest gains come early. Let's build on this.`;
        return `You're at ${currentScore}%${roleStr} 💪 You're on the right path — ${gap} more pts and you hit your next milestone.`;
      }
      if (surface === 'coaching') {
        if (stepsCompleted === 0)
          return `Your coaching plan is ready, ${name} 🚀 Start with the first step — it's the highest-impact action right now.`;
        return `${stepsCompleted} step${stepsCompleted > 1 ? 's' : ''} done 💪 Each one moves the needle. Keep going.`;
      }
      // memory
      if (currentScore < 50)
        return `You're building your foundation, ${name} 🚀 At ${currentScore}%, you're just getting started. Your best gains are still ahead.`;
      return `You're at ${currentScore}%${roleStr} 💪 Steady progress adds up. ${gap > 0 ? `${gap} pts to your next milestone.` : "You've hit your goal — set the next one."}`;
    }
  }
}

// ─── Convenience: full emotion + message in one call ─────────────────────────

export interface AvaPersonality {
  emotion:   AvaEmotionResult;
  message:   string;
}

/**
 * getAvaPersonality(state, msgContext)
 *
 * Single entry point — derive emotion then generate the right message.
 * Pass to any Ava surface component.
 */
export function getAvaPersonality(
  state:   AvaEmotionState,
  msgCtx:  Omit<AvaMessageContext, 'emotion'>,
): AvaPersonality {
  const emotion  = getAvaEmotion(state);
  const message  = generateAvaMessage({ ...msgCtx, emotion: emotion.emotion });
  return { emotion, message };
}