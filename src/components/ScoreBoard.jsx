import React from 'react'

export default function ScoreBoard({ userScore, computerScore }) {
  return (
    <div className="score-panel" aria-label="Match score">
      <div className="meta-label">First to 5</div>
      <div className="score-line">
        <span className="score-player"><span className="score-number" id="computer-score">{computerScore}</span> Opp.</span>
        <span className="score-separator">:</span>
        <span className="score-player">You <span className="score-number" id="user-score">{userScore}</span></span>
      </div>
    </div>
  )
}
