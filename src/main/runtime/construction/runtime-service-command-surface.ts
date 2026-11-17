// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { RuntimeAccountController } from '../agent-session/environment/runtime-account-controller'
import type { RuntimeAiVaultCommands } from '../integrations/ai-vault/runtime-ai-vault-commands'
import type { RuntimeBrowserDriverController } from '../browser/driver/runtime-browser-driver-controller'
import type { RuntimeClientEventBus } from '../client/events/runtime-client-event-bus'
import type { RuntimeMessageWaiters } from '../orchestration/mailbox/runtime-message-waiters'
import type { RuntimeMobileDictationController } from '../speech/runtime-mobile-dictation-controller'

import type { RuntimeMobileSpeechCatalog } from '../speech/runtime-mobile-speech-catalog'
import type { RuntimeNativeChatDraftResolutions } from '../agent-session/launch/runtime-native-chat-draft-resolutions'
import type { RuntimeSessionSearchSettingsController } from '../integrations/ai-vault/runtime-session-search-settings'
import type { RuntimeSubscriptionRegistry } from '../client/runtime-subscription-registry'

export type RuntimeServiceCommandSurface = {
  listAiVaultSessions: RuntimeAiVaultCommands['list']
  resolveAiVaultSessionTitles: RuntimeAiVaultCommands['resolveTitles']
  prepareAiVaultSessionResume: RuntimeAiVaultCommands['prepare']
  deleteAiVaultSession: RuntimeAiVaultCommands['delete']
  setSessionSearchEnabled: RuntimeSessionSearchSettingsController['setEnabled']
  onClientEvent: RuntimeClientEventBus['on']
  notifyNativeChatLaunchDraftResolved: RuntimeNativeChatDraftResolutions['notify']
  registerSubscriptionCleanup: RuntimeSubscriptionRegistry['register']
  registerOwnedSubscriptionCleanup: RuntimeSubscriptionRegistry['registerOwned']
  cleanupSubscription: RuntimeSubscriptionRegistry['cleanup']
  retrySubscriptionCleanupAfter: RuntimeSubscriptionRegistry['retryAfter']
  cleanupSubscriptionAndWait: RuntimeSubscriptionRegistry['cleanupAndWait']
  cleanupSubscriptionsByPrefix: RuntimeSubscriptionRegistry['cleanupByPrefix']
  cleanupSubscriptionsForConnection: RuntimeSubscriptionRegistry['cleanupForConnection']
  cleanupSubscriptionIfOwnedByConnection: RuntimeSubscriptionRegistry['cleanupIfOwnedByConnection']
  getSubscriptionRegistrationVersion: RuntimeSubscriptionRegistry['getRegistrationVersion']
  releaseSubscriptionByRequest: RuntimeSubscriptionRegistry['releaseByRequest']

  setAccountServices: RuntimeAccountController['setServices']

  setCommitMessageAgentEnvironmentResolvers: RuntimeAccountController['setCommitMessageAgentEnvironment']
  getCommitMessageAgentEnvironmentResolvers: RuntimeAccountController['getCommitMessageAgentEnvironment']
  getAccountsSnapshot: RuntimeAccountController['getSnapshot']
  getAccountsStreamSnapshot: RuntimeAccountController['getStreamSnapshot']

  selectClaudeAccount: RuntimeAccountController['selectClaude']
  selectCodexAccount: RuntimeAccountController['selectCodex']
  selectCodexAccountForTarget: RuntimeAccountController['selectCodexForTarget']

  removeClaudeAccount: RuntimeAccountController['removeClaude']
  beginClaudeSignIn: RuntimeAccountController['beginClaudeSignIn']
  finishClaudeSignIn: RuntimeAccountController['finishClaudeSignIn']
  cancelClaudeSignIn: RuntimeAccountController['cancelClaudeSignIn']
  runHostAccountSignIn: RuntimeAccountController['runHostSignIn']
  removeCodexAccount: RuntimeAccountController['removeCodex']
  addCodexAccountFromHome: RuntimeAccountController['addCodexFromHome']

  setHostAccountLaunchEnv: RuntimeAccountController['setHostLaunchEnv']
  restoreHostAccountLaunchEnv: RuntimeAccountController['restoreHostLaunchEnv']
  listMobileSpeechModels: RuntimeMobileSpeechCatalog['list']
  downloadMobileSpeechModel: RuntimeMobileSpeechCatalog['download']
  deleteMobileSpeechModel: RuntimeMobileSpeechCatalog['delete']
  configureMobileDictation: RuntimeMobileSpeechCatalog['configure']
  getOpenAiSpeechKeyStatus: RuntimeMobileSpeechCatalog['openAiKeyStatus']
  setOpenAiSpeechKey: RuntimeMobileSpeechCatalog['setOpenAiKey']
  clearOpenAiSpeechKey: RuntimeMobileSpeechCatalog['clearOpenAiKey']
  startMobileDictation: RuntimeMobileDictationController['start']
  feedMobileDictation: RuntimeMobileDictationController['feed']
  finishMobileDictation: RuntimeMobileDictationController['finish']
  cancelMobileDictation: RuntimeMobileDictationController['cancel']
  getAllBrowserDrivers: RuntimeBrowserDriverController['getAll']
  reclaimBrowserForDesktop: RuntimeBrowserDriverController['reclaimForDesktop']
  notifyMessageArrived(handle: string, messageType?: string): void
  waitForMessage: RuntimeMessageWaiters['wait']
  notifyMessageWaiters: RuntimeMessageWaiters['notify']
  cancelMessageWaiters: RuntimeMessageWaiters['cancel']
}

type RuntimeServiceCommandOwners = {
  aiVault: RuntimeAiVaultCommands
  sessionSearchSettings: RuntimeSessionSearchSettingsController
  clientEvents: RuntimeClientEventBus
  nativeChatDraftResolutions: RuntimeNativeChatDraftResolutions
  subscriptions: RuntimeSubscriptionRegistry

  accounts: RuntimeAccountController
  mobileSpeech: RuntimeMobileSpeechCatalog
  mobileDictation: RuntimeMobileDictationController
  browserDrivers: RuntimeBrowserDriverController
  messageWaiters: RuntimeMessageWaiters
}

export function installRuntimeServiceCommandSurface(
  target: RuntimeServiceCommandSurface,
  owners: RuntimeServiceCommandOwners
): void {
  const vault = owners.aiVault
  const sessionSearchSettings = owners.sessionSearchSettings
  const events = owners.clientEvents
  const drafts = owners.nativeChatDraftResolutions
  const subscriptions = owners.subscriptions

  const accounts = owners.accounts
  const speech = owners.mobileSpeech
  const dictation = owners.mobileDictation
  const browsers = owners.browserDrivers
  const waiters = owners.messageWaiters
  Object.assign(target, {
    listAiVaultSessions: vault.list.bind(vault),
    resolveAiVaultSessionTitles: vault.resolveTitles.bind(vault),
    prepareAiVaultSessionResume: vault.prepare.bind(vault),
    deleteAiVaultSession: vault.delete.bind(vault),
    setSessionSearchEnabled: sessionSearchSettings.setEnabled.bind(sessionSearchSettings),
    onClientEvent: events.on.bind(events),
    notifyNativeChatLaunchDraftResolved: drafts.notify.bind(drafts),
    registerSubscriptionCleanup: subscriptions.register.bind(subscriptions),
    registerOwnedSubscriptionCleanup: subscriptions.registerOwned.bind(subscriptions),
    cleanupSubscription: subscriptions.cleanup.bind(subscriptions),
    retrySubscriptionCleanupAfter: subscriptions.retryAfter.bind(subscriptions),
    cleanupSubscriptionAndWait: subscriptions.cleanupAndWait.bind(subscriptions),
    cleanupSubscriptionsByPrefix: subscriptions.cleanupByPrefix.bind(subscriptions),
    cleanupSubscriptionsForConnection: subscriptions.cleanupForConnection.bind(subscriptions),
    cleanupSubscriptionIfOwnedByConnection:
      subscriptions.cleanupIfOwnedByConnection.bind(subscriptions),
    getSubscriptionRegistrationVersion: subscriptions.getRegistrationVersion.bind(subscriptions),
    releaseSubscriptionByRequest: subscriptions.releaseByRequest.bind(subscriptions),

    setAccountServices: accounts.setServices.bind(accounts),

    setCommitMessageAgentEnvironmentResolvers:
      accounts.setCommitMessageAgentEnvironment.bind(accounts),
    getCommitMessageAgentEnvironmentResolvers:
      accounts.getCommitMessageAgentEnvironment.bind(accounts),
    getAccountsSnapshot: accounts.getSnapshot.bind(accounts),
    getAccountsStreamSnapshot: accounts.getStreamSnapshot.bind(accounts),

    selectClaudeAccount: accounts.selectClaude.bind(accounts),
    selectCodexAccount: accounts.selectCodex.bind(accounts),
    selectCodexAccountForTarget: accounts.selectCodexForTarget.bind(accounts),

    removeClaudeAccount: accounts.removeClaude.bind(accounts),
    beginClaudeSignIn: accounts.beginClaudeSignIn.bind(accounts),
    finishClaudeSignIn: accounts.finishClaudeSignIn.bind(accounts),
    cancelClaudeSignIn: accounts.cancelClaudeSignIn.bind(accounts),
    runHostAccountSignIn: accounts.runHostSignIn.bind(accounts),
    removeCodexAccount: accounts.removeCodex.bind(accounts),
    addCodexAccountFromHome: accounts.addCodexFromHome.bind(accounts),

    setHostAccountLaunchEnv: accounts.setHostLaunchEnv.bind(accounts),
    restoreHostAccountLaunchEnv: accounts.restoreHostLaunchEnv.bind(accounts),
    listMobileSpeechModels: speech.list.bind(speech),
    downloadMobileSpeechModel: speech.download.bind(speech),
    deleteMobileSpeechModel: speech.delete.bind(speech),
    configureMobileDictation: speech.configure.bind(speech),
    getOpenAiSpeechKeyStatus: speech.openAiKeyStatus.bind(speech),
    setOpenAiSpeechKey: speech.setOpenAiKey.bind(speech),
    clearOpenAiSpeechKey: speech.clearOpenAiKey.bind(speech),
    startMobileDictation: dictation.start.bind(dictation),
    feedMobileDictation: dictation.feed.bind(dictation),
    finishMobileDictation: dictation.finish.bind(dictation),
    cancelMobileDictation: dictation.cancel.bind(dictation),
    getAllBrowserDrivers: browsers.getAll.bind(browsers),
    reclaimBrowserForDesktop: browsers.reclaimForDesktop.bind(browsers),
    waitForMessage: waiters.wait.bind(waiters),
    notifyMessageWaiters: waiters.notify.bind(waiters),
    cancelMessageWaiters: waiters.cancel.bind(waiters)
  })
}
