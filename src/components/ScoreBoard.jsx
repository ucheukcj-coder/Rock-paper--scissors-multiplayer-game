import React from 'react'

export default function ScoreBoard({ userScore, computerScore }) {
  return (
    <div id="score">
      Score: <span id="user-score">{userScore}</span> - <span id="computer-score">{computerScore}</span>
    </div>
  )
}
