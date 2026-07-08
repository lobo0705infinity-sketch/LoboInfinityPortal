import type { LeagueNotification } from '../../api'
import type { ApiOptions } from '../../apiCore'

export interface NotificationRepository {
  getNotifications(options?: ApiOptions): Promise<LeagueNotification[]>
  updateNotificationState(
    params: {
      notificationId: string
      notificationIds?: string[]
      state: 'archived' | 'dismissed' | 'read'
    },
    options?: ApiOptions,
  ): Promise<void>
}
