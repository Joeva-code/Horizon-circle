import { prisma } from '../config/database.js';
import { sendVerificationEmail } from './emailService.js';

const settings = () => ({
  pollIntervalMs: Number(process.env.EMAIL_QUEUE_POLL_INTERVAL_MS || 5_000),
  staleLockMs: Number(process.env.EMAIL_QUEUE_STALE_LOCK_MS || 5 * 60_000),
  maxAttempts: Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || 5)
});

const retryAt = (attempts) => new Date(Date.now() + Math.min(60_000 * 2 ** (attempts - 1), 60 * 60_000));

export const enqueueVerificationEmail = (tx, { user, token }) => tx.emailJob.create({
  data: {
    type: 'VERIFICATION',
    userId: user.id,
    // The unhashed token is required only by the worker to construct the link.
    // It is removed once delivered and is never returned by the API.
    payload: { email: user.email, firstName: user.firstName, token }
  }
});

const claimNextJob = async () => {
  const now = new Date();
  const staleBefore = new Date(Date.now() - settings().staleLockMs);
  const job = await prisma.emailJob.findFirst({
    where: {
      OR: [
        { status: 'PENDING', runAt: { lte: now } },
        { status: 'PROCESSING', lockedAt: { lte: staleBefore } }
      ]
    },
    orderBy: { runAt: 'asc' }
  });
  if (!job) return null;

  const claimed = await prisma.emailJob.updateMany({
    where: {
      id: job.id,
      OR: [
        { status: 'PENDING', runAt: { lte: now } },
        { status: 'PROCESSING', lockedAt: { lte: staleBefore } }
      ]
    },
    data: { status: 'PROCESSING', lockedAt: now, attempts: { increment: 1 } }
  });
  return claimed.count ? { ...job, attempts: job.attempts + 1 } : null;
};

export const processEmailQueue = async () => {
  const job = await claimNextJob();
  if (!job) return false;

  try {
    if (job.type === 'VERIFICATION') {
      const { email, firstName, token } = job.payload;
      await sendVerificationEmail({ email, firstName, token });
    }
    await prisma.emailJob.update({
      where: { id: job.id },
      data: { status: 'SENT', sentAt: new Date(), lockedAt: null, payload: {} }
    });
  } catch (error) {
    const exhausted = job.attempts >= settings().maxAttempts;
    await prisma.emailJob.update({
      where: { id: job.id },
      data: {
        status: exhausted ? 'FAILED' : 'PENDING',
        lockedAt: null,
        runAt: exhausted ? job.runAt : retryAt(job.attempts),
        lastError: error.message?.slice(0, 2_000) || 'Email delivery failed'
      }
    });
    console.error(`Email job ${job.id} failed (attempt ${job.attempts}/${settings().maxAttempts}):`, error.message);
  }
  return true;
};

export const startEmailQueueWorker = () => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Process a small batch per tick without allowing an SMTP outage to block HTTP requests.
      for (let index = 0; index < 10 && await processEmailQueue(); index += 1) {}
    } catch (error) {
      console.error('Email queue worker error:', error);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, settings().pollIntervalMs);
};
