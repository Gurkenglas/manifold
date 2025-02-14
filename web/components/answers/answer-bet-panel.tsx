import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { XIcon } from '@heroicons/react/solid'

import { Answer } from 'common/answer'
import { FreeResponseContract } from 'common/contract'
import { BuyAmountInput } from '../amount-input'
import { Col } from '../layout/col'
import { APIError, placeBet } from 'web/lib/firebase/api'
import { Row } from '../layout/row'
import { Spacer } from '../layout/spacer'
import {
  formatMoney,
  formatPercent,
  formatWithCommas,
} from 'common/util/format'
import { InfoTooltip } from '../info-tooltip'
import { useUser } from 'web/hooks/use-user'
import {
  getDpmOutcomeProbability,
  calculateDpmShares,
  calculateDpmPayoutAfterCorrectBet,
  getDpmOutcomeProbabilityAfterBet,
} from 'common/calculate-dpm'
import { Bet } from 'common/bet'
import { track } from 'web/lib/service/analytics'
import { SignUpPrompt } from '../sign-up-prompt'
import { isIOS } from 'web/lib/util/device'

export function AnswerBetPanel(props: {
  answer: Answer
  contract: FreeResponseContract
  closePanel: () => void
  className?: string
  isModal?: boolean
}) {
  const { answer, contract, closePanel, className, isModal } = props
  const { id: answerId } = answer

  const user = useUser()
  const [betAmount, setBetAmount] = useState<number | undefined>(undefined)

  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inputRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (isIOS()) window.scrollTo(0, window.scrollY + 200)
    inputRef.current && inputRef.current.focus()
  }, [])

  async function submitBet() {
    if (!user || !betAmount) return

    setError(undefined)
    setIsSubmitting(true)

    placeBet({
      amount: betAmount,
      outcome: answerId,
      contractId: contract.id,
    })
      .then((r) => {
        console.log('placed bet. Result:', r)
        setIsSubmitting(false)
        setBetAmount(undefined)
        props.closePanel()
      })
      .catch((e) => {
        if (e instanceof APIError) {
          setError(e.toString())
        } else {
          console.error(e)
          setError('Error placing bet')
        }
        setIsSubmitting(false)
      })

    track('bet', {
      location: 'answer panel',
      outcomeType: contract.outcomeType,
      slug: contract.slug,
      contractId: contract.id,
      amount: betAmount,
      outcome: answerId,
    })
  }

  const betDisabled = isSubmitting || !betAmount || error

  const initialProb = getDpmOutcomeProbability(contract.totalShares, answer.id)

  const resultProb = getDpmOutcomeProbabilityAfterBet(
    contract.totalShares,
    answerId,
    betAmount ?? 0
  )

  const shares = calculateDpmShares(
    contract.totalShares,
    betAmount ?? 0,
    answerId
  )

  const currentPayout = betAmount
    ? calculateDpmPayoutAfterCorrectBet(contract, {
        outcome: answerId,
        amount: betAmount,
        shares,
      } as Bet)
    : 0

  const currentReturn = betAmount ? (currentPayout - betAmount) / betAmount : 0
  const currentReturnPercent = formatPercent(currentReturn)

  return (
    <Col className={clsx('px-2 pb-2 pt-4 sm:pt-0', className)}>
      <Row className="items-center justify-between self-stretch">
        <div className="text-xl">
          Bet on {isModal ? `"${answer.text}"` : 'this answer'}
        </div>

        {!isModal && (
          <button className="btn-ghost btn-circle" onClick={closePanel}>
            <XIcon
              className="mx-auto h-8 w-8 text-gray-500"
              aria-hidden="true"
            />
          </button>
        )}
      </Row>
      <div className="my-3 text-left text-sm text-gray-500">Amount </div>
      <BuyAmountInput
        inputClassName="w-full max-w-none"
        amount={betAmount}
        onChange={setBetAmount}
        error={error}
        setError={setError}
        disabled={isSubmitting}
        inputRef={inputRef}
      />
      <Col className="mt-3 w-full gap-3">
        <Row className="items-center justify-between text-sm">
          <div className="text-gray-500">Probability</div>
          <Row>
            <div>{formatPercent(initialProb)}</div>
            <div className="mx-2">→</div>
            <div>{formatPercent(resultProb)}</div>
          </Row>
        </Row>

        <Row className="items-center justify-between gap-2 text-sm">
          <Row className="flex-nowrap items-center gap-2 whitespace-nowrap text-gray-500">
            <div>
              Estimated <br /> payout if chosen
            </div>
            <InfoTooltip
              text={`Current payout for ${formatWithCommas(
                shares
              )} / ${formatWithCommas(
                shares + contract.totalShares[answerId]
              )} shares`}
            />
          </Row>
          <Row className="flex-wrap items-end justify-end gap-2">
            <span className="whitespace-nowrap">
              {formatMoney(currentPayout)}
            </span>
            <span>(+{currentReturnPercent})</span>
          </Row>
        </Row>
      </Col>

      <Spacer h={6} />

      {user ? (
        <button
          className={clsx(
            'btn self-stretch',
            betDisabled ? 'btn-disabled' : 'btn-primary',
            isSubmitting ? 'loading' : ''
          )}
          onClick={betDisabled ? undefined : submitBet}
        >
          {isSubmitting ? 'Submitting...' : 'Submit trade'}
        </button>
      ) : (
        <SignUpPrompt />
      )}
    </Col>
  )
}
