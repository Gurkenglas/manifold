import {
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { sortBy, uniq } from 'lodash'
import { Group, GROUP_CHAT_SLUG, GroupLink } from 'common/group'
import { updateContract } from './contracts'
import {
  coll,
  getValue,
  getValues,
  listenForValue,
  listenForValues,
} from './utils'
import { Contract } from 'common/contract'

export const groups = coll<Group>('groups')

export function groupPath(
  groupSlug: string,
  subpath?:
    | 'edit'
    | 'markets'
    | 'about'
    | typeof GROUP_CHAT_SLUG
    | 'leaderboards'
) {
  return `/group/${groupSlug}${subpath ? `/${subpath}` : ''}`
}

export function updateGroup(group: Group, updates: Partial<Group>) {
  return updateDoc(doc(groups, group.id), updates)
}

export function deleteGroup(group: Group) {
  return deleteDoc(doc(groups, group.id))
}

export async function listAllGroups() {
  return getValues<Group>(groups)
}

export async function listGroups(groupSlugs: string[]) {
  return Promise.all(groupSlugs.map(getGroupBySlug))
}

export function listenForGroups(setGroups: (groups: Group[]) => void) {
  return listenForValues(groups, setGroups)
}

export function getGroup(groupId: string) {
  return getValue<Group>(doc(groups, groupId))
}

export async function getGroupBySlug(slug: string) {
  const q = query(groups, where('slug', '==', slug))
  const docs = (await getDocs(q)).docs
  return docs.length === 0 ? null : docs[0].data()
}

export function listenForGroup(
  groupId: string,
  setGroup: (group: Group | null) => void
) {
  return listenForValue(doc(groups, groupId), setGroup)
}

export function listenForMemberGroups(
  userId: string,
  setGroups: (groups: Group[]) => void,
  sort?: { by: 'mostRecentChatActivityTime' | 'mostRecentContractAddedTime' }
) {
  const q = query(groups, where('memberIds', 'array-contains', userId))
  const sorter = (group: Group) => {
    if (sort?.by === 'mostRecentChatActivityTime') {
      return group.mostRecentChatActivityTime ?? group.createdTime
    }
    if (sort?.by === 'mostRecentContractAddedTime') {
      return group.mostRecentContractAddedTime ?? group.createdTime
    }
    return group.mostRecentActivityTime
  }
  return listenForValues<Group>(q, (groups) => {
    const sorted = sortBy(groups, [(group) => -sorter(group)])
    setGroups(sorted)
  })
}

export async function listenForGroupsWithContractId(
  contractId: string,
  setGroups: (groups: Group[]) => void
) {
  const q = query(groups, where('contractIds', 'array-contains', contractId))
  return listenForValues<Group>(q, setGroups)
}

export async function addUserToGroupViaId(groupId: string, userId: string) {
  // get group to get the member ids
  const group = await getGroup(groupId)
  if (!group) {
    console.error(`Group not found: ${groupId}`)
    return
  }
  return await joinGroup(group, userId)
}

export async function joinGroup(group: Group, userId: string): Promise<void> {
  const { memberIds } = group
  if (memberIds.includes(userId)) return // already a member

  const newMemberIds = [...memberIds, userId]
  return await updateGroup(group, { memberIds: uniq(newMemberIds) })
}

export async function leaveGroup(group: Group, userId: string): Promise<void> {
  const { memberIds } = group
  if (!memberIds.includes(userId)) return // not a member

  const newMemberIds = memberIds.filter((id) => id !== userId)
  return await updateGroup(group, { memberIds: uniq(newMemberIds) })
}

export async function addContractToGroup(
  group: Group,
  contract: Contract,
  userId: string
) {
  if (contract.groupLinks?.map((l) => l.groupId).includes(group.id)) return // already in that group

  const newGroupLinks = [
    ...(contract.groupLinks ?? []),
    {
      groupId: group.id,
      createdTime: Date.now(),
      slug: group.slug,
      userId,
      name: group.name,
    } as GroupLink,
  ]

  await updateContract(contract.id, {
    groupSlugs: uniq([...(contract.groupSlugs ?? []), group.slug]),
    groupLinks: newGroupLinks,
  })
  return await updateGroup(group, {
    contractIds: uniq([...group.contractIds, contract.id]),
  })
    .then(() => group)
    .catch((err) => {
      console.error('error adding contract to group', err)
      return err
    })
}

export async function removeContractFromGroup(
  group: Group,
  contract: Contract
) {
  if (!contract.groupLinks?.map((l) => l.groupId).includes(group.id)) return // not in that group

  const newGroupLinks = contract.groupLinks?.filter(
    (link) => link.slug !== group.slug
  )
  await updateContract(contract.id, {
    groupSlugs:
      contract.groupSlugs?.filter((slug) => slug !== group.slug) ?? [],
    groupLinks: newGroupLinks ?? [],
  })
  const newContractIds = group.contractIds.filter((id) => id !== contract.id)
  return await updateGroup(group, {
    contractIds: uniq(newContractIds),
  })
    .then(() => group)
    .catch((err) => {
      console.error('error removing contract from group', err)
      return err
    })
}

export async function setContractGroupLinks(
  group: Group,
  contractId: string,
  userId: string
) {
  await updateContract(contractId, {
    groupLinks: [
      {
        groupId: group.id,
        name: group.name,
        slug: group.slug,
        userId,
        createdTime: Date.now(),
      } as GroupLink,
    ],
  })
  return await updateGroup(group, {
    contractIds: uniq([...group.contractIds, contractId]),
  })
    .then(() => group)
    .catch((err) => {
      console.error('error adding contract to group', err)
      return err
    })
}
