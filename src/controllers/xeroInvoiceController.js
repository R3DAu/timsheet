const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * List all Xero invoices (admin only)
 */
async function listInvoices(req, res) {
  try {
    const invoices = await prisma.xeroInvoice.findMany({
      include: {
        employee: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
        entries: { select: { id: true } }
      },
      orderBy: { invoiceMonth: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    console.error('[XeroInvoice] Error listing invoices:', error);
    res.status(500).json({ error: 'Failed to load invoices' });
  }
}

/**
 * Get a single Xero invoice with full details (admin only)
 */
async function getInvoice(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoice = await prisma.xeroInvoice.findUnique({
      where: { id },
      include: {
        employee: true,
        company: true,
        entries: {
          include: {
            timesheet: { select: { weekStarting: true, weekEnding: true } }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('[XeroInvoice] Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to load invoice' });
  }
}

module.exports = { listInvoices, getInvoice };
