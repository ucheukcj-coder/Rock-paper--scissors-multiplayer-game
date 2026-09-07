import React from 'react'

export default function ResultDisplay({ userChoice, computerChoice, result, userScore, computerScore, gameOver }) {
  const userWonGame = userScore >= 5
  const compWonGame = computerScore >= 5

  return (
    <>
      <div className="choices-row">
        <div className="side computer-side">
          <h2 id="computer-choice-header">
            <span className="icon computer-icon">🤖</span>
              <span className="label">Opponent</span>
          </h2>
          <div className="choice-bubble" id="computer-choice">{computerChoice}</div>
        </div>

        <div className="result-center">
          <h2 id="result-header" className={result === 'You Win' ? 'win' : result === 'You Lose' ? 'lose' : ''}>
            <div>Result</div>
            <div><span id="result">{result}</span>
              {userWonGame && (
                <span className="confetti" aria-hidden="true"> 🎉✨</span>
              )}
              {compWonGame && (
                <span className="confetti" aria-hidden="true"> 💥🤖</span>
              )}
            </div>
          </h2>
        </div>

        <div className="side user-side">
          <h2 id="user-choice-header">
            <span className="icon user-icon">🙂</span>
              <span className="label">You</span>
          </h2>
          <div className="choice-bubble" id="user-choice">{userChoice}</div>
        </div>
      </div>
    </>
  )
}
