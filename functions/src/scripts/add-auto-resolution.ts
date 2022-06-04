import * as admin from 'firebase-admin'

import { initAdmin } from './script-init'
initAdmin()

import { getValues } from '../utils'
import { Contract } from '../../../common/contract'
import { DAY_MS } from 'common/util/time'

const firestore = admin.firestore()

async function addAutoResolutionToContracts() {
  console.log('Adding auto resolution to existing contracts')

  const contracts = await getValues<Contract>(firestore.collection('contracts'))

  console.log('Loaded', contracts.length, 'contracts')

  for (const contract of contracts.filter((c) => !c.isResolved)) {
    addAutoResolutionToContract(contract)
  }
}

async function addAutoResolutionToContract(contract: Contract) {
  const contractRef = firestore.doc(`folds/${contract.id}`)
  if (contract.autoResolutionTime != null && contract.autoResolution != null) {
    console.log('Skipping, already has auto resolution', contract.slug)
    return
  }
  if (contract.autoResolutionTime != null || contract.autoResolution != null) {
    console.error(
      'Has partial auto resolution, please check manually',
      contract.slug
    )
    return
  }
  if (contract.closeTime == null) {
    console.error('Has no close time, please check manually', contract.slug)
    return
  }

  const autoResolutionTime =
    contract.closeTime > Date.now()
      ? contract.closeTime + 7 * DAY_MS
      : Date.now() + 14 * DAY_MS

  console.log('Adding auto resolution', contract.slug)

  await contractRef.update({
    autoResolution: 'MKT',
    autoResolutionTime: autoResolutionTime,
  } as Partial<Contract>)
}

if (require.main === module)
  addAutoResolutionToContracts().then(() => process.exit())
