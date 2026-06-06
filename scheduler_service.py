"""Background jobs — IPO sync + market price refresh."""
import logging
import threading
import time

logger = logging.getLogger(__name__)

_started = False


def start_background_jobs(app):
    global _started
    if _started:
        return
    _started = True

    def _loop():
        cycles = 0
        while True:
            try:
                with app.app_context():
                    from market_service import refresh_holdings_prices
                    from ipo_sync import sync_live_ipos
                    refresh_holdings_prices()
                    sync_live_ipos()
                    cycles += 1
                    if cycles % 288 == 0:  # ~24h at 5min intervals
                        from alert_service import run_daily_alerts
                        run_daily_alerts()
                    logger.info('Background sync: market + IPO feed')
            except Exception as exc:
                logger.warning('Background sync error: %s', exc)
            time.sleep(5 * 60)

    t = threading.Thread(target=_loop, daemon=True, name='fo-scheduler')
    t.start()
