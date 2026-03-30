"use client";

import { useState } from "react";
import type { CharacterCard, StoryResult } from "@/lib/schemas";

export function StoryBoard({ story }: { story: StoryResult }) {
  return (
    <section className="result-panel">
      <div className="panel-head">
        <span className="panel-tag">剧情方案</span>
        <h2 className="panel-title">{story.storyPositioning}</h2>
      </div>

      <div className="story-hero-card">
        <div className="story-hero-meta">
          <div>
            <p className="kicker">情绪基调</p>
            <p>{story.emotionalTone}</p>
          </div>
          <div>
            <p className="kicker">核心角色</p>
            <div className="character-tags">
              {story.characterRoster.map((name) => (
                <span className="pill" key={name}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="story-world-box">
          <p className="kicker">世界观摘要</p>
          <p>{story.worldSummary}</p>
        </div>
      </div>

      <div className="summary-box section-box" style={{ marginTop: 18 }}>
        <p className="kicker">01 / 核心冲突</p>
        <p>{story.coreConflict}</p>
      </div>

      <div className="summary-box section-box story-scroll-box" style={{ marginTop: 18 }}>
        <p className="kicker">02 / 主线剧情</p>
        <ul className="list">
          {story.mainPlotBeats.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="summary-box section-box" style={{ marginTop: 18 }}>
        <p className="kicker">03 / 章节与活动锚点</p>
        <div className="story-anchor-grid">
          {story.chapterAnchors.map((item) => (
            <div className="anchor-chip" key={item}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CharacterCarousel({ cards }: { cards: CharacterCard[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = cards[activeIndex];

  const goPrev = () => setActiveIndex((value) => (value - 1 + cards.length) % cards.length);
  const goNext = () => setActiveIndex((value) => (value + 1) % cards.length);

  return (
    <section className="result-panel">
      <div className="panel-head">
        <span className="panel-tag">角色资料卡</span>
        <h2 className="panel-title">角色资料卡</h2>
      </div>

      <div className="card-pager-head">
        <div className="card-pager-meta">
          <span className="pill">
            {activeIndex + 1} / {cards.length}
          </span>
          <span className="pill">{current.rolePositioning}</span>
        </div>
        <div className="card-pager-actions">
          <button className="tab-button" type="button" onClick={goPrev}>
            上一张
          </button>
          <button className="tab-button is-active" type="button" onClick={goNext}>
            下一张
          </button>
        </div>
      </div>

      <article className="character-card character-card-featured">
        <div className="character-head character-head-featured">
          <div>
            <div className="character-name">{current.name}</div>
            <div className="character-role">{current.rolePositioning}</div>
          </div>
          <div className="character-tags">
            {current.personalityTags.map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="character-detail-grid">
          <div className="character-block">
            <span className="kicker">背景摘要</span>
            <p>{current.backgroundSummary}</p>
          </div>
          <div className="character-block">
            <span className="kicker">互动职责</span>
            <p>{current.interactionResponsibility}</p>
          </div>
          <div className="character-block">
            <span className="kicker">收集价值</span>
            <p>{current.collectionValue}</p>
          </div>
          <div className="character-block">
            <span className="kicker">关联系统</span>
            <div className="character-tags">
              {current.relatedSystems.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="character-block">
            <span className="kicker">关联剧情锚点</span>
            <div className="character-tags">
              {current.storyAnchors.map((tag) => (
                <span className="pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="character-block">
          <span className="kicker">视觉关键词</span>
          <div className="character-tags">
            {current.visualKeywords.map((tag) => (
              <span className="pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>

      <div className="card-page-dots">
        {cards.map((card, index) => (
          <button
            key={card.name}
            type="button"
            className={`card-dot${index === activeIndex ? " is-active" : ""}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`查看角色 ${card.name}`}
          />
        ))}
      </div>
    </section>
  );
}
