/**
 * @file src/features/premium/components/SkillGapList.tsx
 * @description Renders the list of missing skills with priority badges.
 */

import React from 'react';
import type { SkillGap, MissingSkill } from '../types';

const PRIORITY_LABELS: Record<string, string> = {
  high_priority:   'High Priority',
  medium_priority: 'Medium',
  low_priority:    'Low',
};

export interface SkillGapListProps {
  skillGap: SkillGap;
}

export function SkillGapList({ skillGap }: SkillGapListProps) {
  const { missingSkills } = skillGap;

  if (!missingSkills || missingSkills.length === 0) {
    return (
      <div className="premium-skill-gap" role="region" aria-label="Skill Gaps">
        <h3 className="premium-skill-gap__title">Skill Gaps</h3>
        <p className="premium-skill-gap__empty">No critical skill gaps detected.</p>
      </div>
    );
  }

  const sorted = [...missingSkills].sort((a, b) => {
    const priorityOrder: Record<string, number> = {
      high_priority: 0, medium_priority: 1, low_priority: 2,
    };
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  return (
    <div className="premium-skill-gap" role="region" aria-label="Skill Gaps">
      <h3 className="premium-skill-gap__title">
        Skill Gaps <span className="premium-skill-gap__count">({missingSkills.length})</span>
      </h3>
      <ul className="premium-skill-gap__list" role="list">
        {sorted.map((skill: MissingSkill) => (
          <li key={skill.skill_name} className="premium-skill-gap__item">
            <div className="premium-skill-gap__skill-row">
              <span className="premium-skill-gap__skill-name">{skill.skill_name}</span>
              <span
                className={`premium-skill-gap__priority premium-skill-gap__priority--${skill.priority}`}
                aria-label={PRIORITY_LABELS[skill.priority] ?? skill.priority}
              >
                {PRIORITY_LABELS[skill.priority] ?? skill.priority}
              </span>
            </div>
            <div className="premium-skill-gap__meta">
              <span className="premium-skill-gap__category">{skill.skill_category}</span>
              <span className="premium-skill-gap__weeks">
                ~{skill.estimatedWeeksToLearn}w to learn
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
