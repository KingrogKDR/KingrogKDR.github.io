{
"title": "Designing Metrics for Athens: A Go Module Proxy",
"slug": "designing-metrics-for-athens-go-module-proxy",
"date": "2026-06-26",
"tag": ["Go", "Open Source", "Observability", "Prometheus"],
"excerpt": "A deep dive into my open source contribution to Athens, where I designed and implemented cache lookup and upstream fetch metrics to improve observability for production deployments.",
"pinned": true,
"og-image": "images/og/designing-metrics-for-athens-go-module-proxy.png"
}

---

When you run a service in production, one of the first questions you would want to ask after deploying it is, _“How is it performing?”_ For a Go Module Proxy like Athens, that translates to questions like:

- How many requests are served from cache?
- How often is the proxy fetching modules from upstream sources?
- Are these upstream sources being slower over time?

Without instrumentation, these questions are difficult to answer and operators often have to rely on logs or guesswork instead of concrete, measurable data.

This started while I was exploring the Athens codebase for a potential open source contribution, I noticed that these insights were not readily available through metrics. That observation led me to propose and implement a set of OpenCensus metrics covering cache lookups and upstream fetch operations.

In this blog post, I walk through the engineering behind that contribution and the decisions I made along the way.

Note: The PR was merged about three months earlier than this blog post was written. You can view the PR here.

# What is Athens?

Before diving deeper, it helps to understand where Athens sits in the Go ecosystem.

When you run a command `go get` or `go mod download` , the Go toolchain typically fetches modules through a module proxy instead of version control systems (github, gitlab, codeberg, .etc) directly. A Go module proxy serves previously downloaded modules from local storage and only reaches out to upstream sources when a requested module is missing. This design reduces dependency on external packages and speeds up repeated downloads.

![go-module-proxy](images/athens/go-module-proxy.excalidraw.png)

_The GO Module Proxy_

Unlike the public Go module proxy operated by Google (proxy.golang.org), Athens is designed to be self-hosted and fully under the operator’s control. Organizations can deploy it within their own infrastructure, back it with storage systems such as a local filesystem or object stores like S3 and MinIO, and use it to cache both public and private modules. This makes Athens particularly attractive for individuals and orgs that require reduced dependency on external services, or stricter control over their software supply chain. Because it is open source and extensible, it also provides contributors with an opportunity to improve production features.

# How it started?

I've always been curious about how Go manages dependencies under the hood. Learning about `go get`, `go.mod`, `go.sum`, module mirrors, and the Go module proxy ecosystem made me appreciate the thought that has gone into ensuring reliability and reducing “dependency”. Naturally, I wanted to see if there were open-source implementations of a Go module proxy beyond the one operated by Google.

Then I discovered Athens. As a self-hosted, open-source Go module proxy, it caught my immediate interest. I knew I would likely use it in future projects, so contributing to it seemed like a great way to understand its internals while giving something back to the community.

I forked the repository and spent a few days exploring the codebase, tracing request flows, and familiarizing myself with its architecture before writing any code. Mainly peeping around to see if I can make myself useful somewhere.

While reading through the observability layer, I started asking myself a simple question: _"If I were operating this service in production, what metrics would I want to see on my dashboard?"_ Athens already exposed some metrics, but I noticed that visibility into cache lookups and upstream fetch behavior could be improved. Those are exactly the kinds of signals that help diagnose cache efficiency and understand when the proxy is relying on external sources.

With that motivation, I opened an issue proposing the addition of these metrics (see the issue here). After sometime, one of the project members encouraged me to go ahead and implement it. That conversation became the starting point for my contribution.

# My proposal

As I traced the request lifecycle, I realized there was no easy way to quantify one of the most important characteristics of a caching proxy: _how effectively it was using its cache_. An operator could infer behavior from logs, but there was no dedicated metric indicating whether a module request resulted in a cache hit or required contacting an upstream source.

Similarly, while upstream fetches were a critical part of the request path, there was limited visibility into how frequently they occurred or how long they took. These values are especially useful when investigating increased latency, diagnosing cache misses, or monitoring the health of external dependencies.

Hence, I proposed three additional metrics:

- A cache lookup counter to track cache hits and misses (including the type of protocol for e.g Info, Zip and Mod).
- An upstream fetch counter to measure how often Athens retrieves modules from external sources.
- An upstream fetch duration histogram to capture the latency distribution of those fetch operations.

Together, these metrics provide a clearer picture of Athens' behavior in production while keeping the instrumentation lightweight and avoiding high-cardinality labels that could negatively impact the system.

With the metrics identified, the next step was identifying where they should be recorded.

I first traced the complete lifecycle of a module request through the Athens codebase. Starting from the HTTP handlers, I followed the execution path into the storage and download logic to understand how a request eventually resulted in either a cache hit or an upstream fetch.

This exploration revealed two natural instrumentation points:

- The cache lookup path, where Athens determines whether the requested module already exists in storage.
- The upstream fetch path, where Athens retrieves a missing module from its source and persists it for future requests.

![metrics-location](images/athens/metrics-location.excalidraw.png)

_Metrics location pathwise_

For the cache lookups, I chose a counter with a low-cardinality label indicating whether the lookup resulted in a **hit** or a **miss**. This allows operators to calculate cache hit ratios over time without creating a separate time series for every module or request. It was also independent of the upstream path.

The upstream fetch metric was implemented as a simple counter that increments whenever Athens has to retrieve a module from an external source. A sudden increase in this value could indicate a cold cache, frequent cache invalidations, or an unexpected traffic pattern.

Finally, I added a histogram to measure upstream fetch duration. While an average latency can hide performance issues, a histogram preserves the distribution of values, making it possible to analyze percentiles such as p95 or p99.

# Key Decisions

One of the most important decisions during implementation was the choice of tags. The implementation intentionally uses a small, bounded set of values such as `success`, `failure`, `hit`, and `miss`. Low-cardinality labels for the win!

Attaching high-cardinality labels like module path or version would generate an enormous number of unique time series and place unnecessary load on monitoring systems. Instead, the metrics were intentionally designed with a small, bounded set of labels that remain useful at scale.

### Why histograms instead of averages?

Following are the bucket boundaries I used:

```go
Aggregation: view.Distribution(
    0.05,
    0.1,
    0.2,
    0.5,
    1,
    2,
    5,
    10,
    30,
)
```

If fetch durations are 0.04s, 0.08s, 0.15s, 0.90s, 1.30s, etc., they fall into buckets like:

≤ 0.05s = 1

≤ 0.1s = 1

≤ 0.2s = 1

≤ 0.5s = 0

≤ 1s = 1

≤ 2s = 1

So, it groups the latency values into ranges.

If we were using average, suppose for two datasets:

```
Run A: 100ms, 100ms, 100ms, 100ms
Average = 100ms
```

```
Run B: 10ms, 10ms, 10ms, 370ms
Average = 100ms
```

The averages are identical, but Run B has a serious latency spike.

Histograms preserve the distribution, allowing to compute p95 and p99 latencies and detect outliers.

# Implementation, Testing and Results

The implementation itself was relatively straightforward.

I introduced three new OpenCensus measures and corresponding views:

- `cache_lookup_total` to count cache hits and misses.
- `upstream_fetch_total` to count attempts to fetch modules from upstream sources.
- `upstream_fetch_duration_seconds` to capture the latency distribution of upstream fetches.

```go
var (
	cacheResult = tag.MustNewKey("cache_result")
	cacheType   = tag.MustNewKey("cache_type")
	fetchResult = tag.MustNewKey("fetch_result")
)

var (
	cacheStats                 = stats.Int64("cache_lookup_total", "Count of cache lookup results", stats.UnitDimensionless)
	upstreamFetchStats         = stats.Int64("upstream_fetch_total", "Count of upstream fetch attempts", stats.UnitDimensionless)
	upstreamFetchDurationStats = stats.Float64("upstream_fetch_duration_seconds", "Distribution of upstream fetch latency in seconds", stats.UnitSeconds)
)

var upstreamExponentialBuckets = []float64{0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30}

var (
	cacheLookupView = &view.View{
		Name:        "cache_lookup_total",
		Measure:     cacheStats,
		Description: "Count of cache lookup results",
		TagKeys:     []tag.Key{cacheResult, cacheType},
		Aggregation: view.Count(),
	}
	upstreamFetchView = &view.View{
		Name:        "upstream_fetch_total",
		Measure:     upstreamFetchStats,
		Description: "Count of upstream fetch attempts",
		TagKeys:     []tag.Key{fetchResult},
		Aggregation: view.Count(),
	}
	upstreamFetchLatencyView = &view.View{
		Name:        "upstream_fetch_duration_seconds",
		Measure:     upstreamFetchDurationStats,
		Description: "Distribution of upstream fetch latency in seconds",
		TagKeys:     []tag.Key{fetchResult},
		Aggregation: view.Distribution(upstreamExponentialBuckets...),
	}
)
```

For cache lookups, I tagged each metric with both the lookup result (`hit` or `miss`) and the artifact type (`info`, `mod`, or `zip`). This makes it possible to answer questions such as whether source archives are being cached effectively or whether metadata lookups are frequently missing.

For upstream fetches, I recorded both the outcome of the fetch and its duration. Rather than exposing only an average latency, I used a histogram with predefined bucket boundaries ranging from 50 milliseconds to 30 seconds. This allows operators to compute latency percentiles and quickly identify slow upstream operations.

To verify the implementation, I added unit tests for each metric. These tests register the corresponding OpenCensus view, record a sample event, retrieve the aggregated data, and assert that the expected values have been recorded.

Beyond unit testing, I ran Athens locally: (there are many ways to do it) Please refer their Development.md:

Following is the way I did it:

```bash
# ensure docker and docker-compose are installed
make run-docker

# generate traffic
go env -w GOPROXY=http://localhost:3000
go mod download github.com/gorilla/mux@latest
go mod download golang.org/x/text@latest

# inspect metrics
curl http://localhost:3000/metrics | grep cache_lookup_total
curl http://localhost:3000/metrics | grep upstream_fetch_total
curl http://localhost:3000/metrics | grep upstream_fetch_duration_seconds
```

The exported metrics showed both cache hits and misses:

![results](images/athens/results.png)

These results confirmed that the metrics were correctly instrumented and exposed through the Prometheus endpoint, making them immediately consumable by monitoring systems such as Grafana.

With these metrics, operators can now distinguish between cache hits and misses, understand which artifact types are being requested, monitor how often Athens communicates with upstream sources, and measure the latency of those fetch operations.

For example, in my local testing, only two upstream fetches were required while multiple requests were served directly from the cache. This demonstrates one of the key benefits of a module proxy: once an artifact has been downloaded and cached, subsequent requests can often be satisfied without contacting external services.

# Lessons Learned

Looking back, the most valuable part of this contribution was understanding the problem well enough to design the right solution and not writing the code.

The first lesson was that effective observability starts with asking the right questions. Rather than adding metrics indiscriminately, I focused on what an operator would actually want to know: _Is the cache working? How often are we contacting upstream sources? How long do those operations take?_

The second lesson was the importance of low-cardinality labels. Restricting labels to bounded values like `hit`, `miss`, `success`, `info`, `gomod`, and `zip` keeps the metrics scalable while still providing meaningful insight.

Lastly, contributing to an established open-source project reinforced the value of spending time reading code before writing it. I spent considerably more time tracing request paths, understanding existing abstractions, and identifying the correct instrumentation points than I did implementing the metrics themselves. That upfront investment made the final change smaller, easier to review, and better aligned with the project's architecture.

Although the pull request was modest in size, it deepened my understanding of Go's module ecosystem, production observability, and the engineering trade-offs involved in adding instrumentation to real-world systems.
