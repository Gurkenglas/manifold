import { Bet } from 'common/bet'
import { Contract } from 'common/contract'
import { Comment } from 'web/lib/firebase/comments'
import { User } from 'common/user'
import { useUserById } from 'web/hooks/use-user'
import { CommentTipMap } from 'web/hooks/use-tip-txns'
import { LiquidityProvision } from 'common/liquidity-provision'
import { Avatar } from 'web/components/avatar'
import { Grid, _ } from 'gridjs-react'

export function ContractTabs(props: {
  contract: Contract
  user: User | null | undefined
  bets: Bet[]
  liquidityProvisions: LiquidityProvision[]
  comments: Comment[]
  tips: CommentTipMap
}) {
  const { bets } = props
  const FormatUser = (s: string) => {
    const u = useUserById(s)
    return _(
      <div className="flex">
        <Avatar username={u?.username} avatarUrl={u?.avatarUrl} size="sm" />
        {u?.username}
      </div>
    )
  }
  return (
    <Grid
      data={[{ userId: bets[0].userId }]}
      columns={[{ name: 'User', id: 'userId', formatter: FormatUser }]}
    />
  )
}
