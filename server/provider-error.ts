/** Public, fixed messages only: upstream response bodies and credentials never reach the browser. */
export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
export async function providerHTTPError(
  response: Response,
): Promise<ProviderError> {
  let hint = "";
  try {
    const data = (await response.json()) as {
      error?: { code?: unknown; type?: unknown };
    };
    hint = [data.error?.code, data.error?.type]
      .filter((v) => typeof v === "string")
      .join(" ")
      .toLowerCase();
  } catch {}
  if (
    /insufficient_quota|insufficient_balance|billing|balance_not_enough/.test(
      hint,
    ) ||
    response.status === 402
  )
    return new ProviderError(
      "MODEL_QUOTA",
      "模型平台余额或可用额度不足。请到所选模型平台检查充值、账单或调用额度；不需要重填同一把 Key。",
      402,
    );
  if (response.status === 401 || /invalid_api_key|authentication/.test(hint))
    return new ProviderError(
      "KEY_INVALID",
      "模型平台拒绝了 API Key（401）。请确认 Key 属于当前选择的平台，并且没有过期或被撤销。",
      401,
    );
  if (response.status === 403)
    return new ProviderError(
      "MODEL_FORBIDDEN",
      "模型平台拒绝访问（403）。请检查账号、模型使用权限及服务地区限制。",
      403,
    );
  if (response.status === 404 || /model_not_found|invalid_model/.test(hint))
    return new ProviderError(
      "MODEL_NOT_FOUND",
      "模型不存在或当前账号无权使用。请核对模型名称与所选平台是否一致。",
      404,
    );
  if (response.status === 429)
    return new ProviderError(
      "MODEL_RATE_LIMIT",
      "模型平台限制了请求频率或额度（429）。请稍后重试，并在模型平台检查调用限额。",
      429,
    );
  if (response.status === 400 || response.status === 422)
    return new ProviderError(
      "MODEL_PARAMETERS",
      "模型平台不接受当前请求参数。请确认模型名称正确，并使用支持 Chat Completions 和 JSON 输出的模型。",
      400,
    );
  return new ProviderError(
    "MODEL_UNAVAILABLE",
    `模型平台暂时不可用（HTTP ${response.status}）。请稍后重试。`,
    502,
    response.status >= 500,
  );
}
