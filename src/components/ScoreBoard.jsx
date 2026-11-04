import React from 'react'

export default function ScoreBoard({ userScore, computerScore, userName = 'You', opponentName = 'Opponent' }) {
  return (
    <div className="score-panel" aria-label="Match score">
      <div className="score-player score-user">
        <span className="score-avatar">{userName.slice(0, 1).toUpperCase()}</span>
        <span className="score-identity"><strong>{userName}</strong><small>You</small></span>
      </div>
      <div className="score-tally">
        <span className="meta-label">First to 5</span>
        <div className="score-line">
          <span className="score-number" id="user-score">{userScore}</span>
          <span className="score-separator">:</span>
          <span className="score-number" id="computer-score">{computerScore}</span>
        </div>
      </div>
      <div className="score-player score-opponent">
        <span className="score-identity"><strong>{opponentName}</strong><small>Opponent</small></span>
        <span className="score-avatar">{opponentName.slice(0, 1).toUpperCase()}</span>
      </div>
    </div>
  )
}
