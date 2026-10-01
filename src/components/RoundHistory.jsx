import React from 'react'

export default function RoundHistory({ rounds, opponentName }) {
  return (
    <section className="round-history" aria-labelledby="round-history-title">
      <div className="round-history-heading">
        <h2 id="round-history-title">Round history</h2>
        <span>{rounds.length} {rounds.length === 1 ? 'round' : 'rounds'}</span>
      </div>
      {rounds.length === 0 ? (
        <p className="round-history-empty">Completed rounds will appear here.</p>
      ) : (
        <div className="round-history-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">You</th>
                <th scope="col">{opponentName}</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map(({ round, playerChoice, opponentChoice, result }) => (
                <tr key={round}>
                  <th scope="row">{round}</th>
                  <td>{playerChoice}</td>
                  <td>{opponentChoice}</td>
                  <td className={'history-result ' + (result === 'You Win' ? 'win' : result === 'You Lose' ? 'lose' : 'draw')}>
                    {result === 'You Win' ? 'Win' : result === 'You Lose' ? 'Loss' : 'Draw'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}