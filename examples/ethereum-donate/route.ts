import { ethers } from 'ethers';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import {
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse,
} from '../../spec/actions-spec';

const DONATION_DESTINATION_WALLET =
  '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const DONATION_AMOUNT_ETH_OPTIONS = [0.01, 0.05, 0.1];
const DEFAULT_DONATION_AMOUNT_ETH = 0.01;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Ethereum Donate'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const { icon, title, description } = getDonateInfo();
    const amountParameterName = 'amount';
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${DEFAULT_DONATION_AMOUNT_ETH} ETH`,
      title,
      description,
      links: {
        actions: [
          ...DONATION_AMOUNT_ETH_OPTIONS.map((amount) => ({
            label: `${amount} ETH`,
            href: `/api/donate/${amount}`,
          })),
          {
            href: `/api/donate/{${amountParameterName}}`,
            label: 'Donate',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom ETH amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{amount}',
    tags: ['Ethereum Donate'],
    request: {
      params: z.object({
        amount: z.string().openapi({
          param: {
            name: 'amount',
            in: 'path',
          },
          type: 'number',
          example: '0.1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const amount = c.req.param('amount');
    const { icon, title, description } = getDonateInfo();
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${amount} ETH`,
      title,
      description,
    };
    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{amount}',
    tags: ['Ethereum Donate'],
    request: {
      params: z.object({
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '0.1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const amount =
      c.req.param('amount') ?? DEFAULT_DONATION_AMOUNT_ETH.toString();
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

    const parsedAmount = ethers.utils.parseEther(amount);
    const transaction = await prepareDonateTransaction(
      account,
      DONATION_DESTINATION_WALLET,
      parsedAmount,
    );
    const response: ActionsSpecPostResponse = {
      transaction: JSON.stringify(transaction), // TODO: create a new ActionsSpecPostResponse type for ethereum
    };
    return c.json(response, 200);
  },
);

async function prepareDonateTransaction(
  sender: string,
  recipient: string,
  amount: ethers.BigNumber,
): Promise<ethers.utils.UnsignedTransaction> {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ETHEREUM_RPC_URL,
  );
  const nonce = await provider.getTransactionCount(sender);
  const gasPrice = await provider.getGasPrice();

  return {
    to: recipient,
    value: amount,
    nonce: nonce,
    gasLimit: ethers.utils.hexlify(21000), // Standard gas limit for ETH transfers
    gasPrice: gasPrice,
  };
}

function getDonateInfo(): Pick<
  ActionsSpecGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon =
    'https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb146c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/';
  const title = 'Donate to Alice';
  const description =
    'Ethereum Enthusiast | Support my research with an ETH donation.';
  return { icon, title, description };
}

export default app;
