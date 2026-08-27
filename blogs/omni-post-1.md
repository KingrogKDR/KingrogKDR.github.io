{
"title": "JSON vs Protobuf: choosing a wire format",
"slug": "omni-post-1",
"date": "2026-08-16",
"tag": ["Design Decisions", "Protobuf", "JSON", "Omni"],
"excerpt": "Why JSON's type ambiguity made me nervous about building a database on top of it, what Protobuf fixes, and the pitfalls it introduces in exchange.",
"series": "omni-build-log",
"pinned": true
}

---

> This is the first post in a series building Omni, a distributed database, from scratch

A database at its core is just a place to store data and get it back later when we need it. That much doesn't need a network. You can write bytes to a file on disk and call it done.

Which raised a question in my mind: Why does almost every _"real"_ database out there listens on a socket, forcing every read and write through a network boundary even if the network is localhost, where one process talks to another on the same machine? So, I had to find it out.

# Why does a database need a network at all?

The answer starts with something obvious. Data gets stored in databases and then this data is retrieved. But who retrieves this data? Yes, they can be multiple callers, for e.g, multiple users, multiple applications, multiple services, etc. Also, data doesn't get written or read once and left alone. It gets read and written by all these different callers, often at nearly the same time.

If they all reached directly into the same file on disk, nothing stops two writes from colliding mid-write, or a read from catching data in a half-written state. A file on disk has no such concept of "wait, it's not your turn yet". It just holds bytes. Someone has to sit in front of the file and arbitrate: decide the order that should be followed. This should solve two major problems: one is the corruption from concurrent writes and the other is a caller reading inconsistent data.

That's the actual job of the network boundary. It's there because the database needs a gatekeeper.

This gatekeeper is the first real design decision in building any database. And it turns out to be a harder question than it looks.

So far, none of this required more than a single machine. Now, when you go distributed, i.e add more machines. These machines, a.k.a nodes, holding the data have to talk to each other. They have to agree on what the current global state actually is, to not lose or corrupt data on a single machine, to figure out which node is responsible for what piece of data. Yes, this became far more complex, too quickly. Let's start simpler, shall we? First, we have to determine a format that the network layer will talk in.

# JSON vs Protobuf: why does the wire format matters?

Okay, one thing I want to put out there. I have used JSON at times, but not exhaustingly enough or haven't pushed its boundaries much so I don't have an expert opinion on it. But it does have some flaws that make it not suitable for what I am building.

Not having comments is one of them, but it is rather an inconvenience and not a flaw in my opinion. But the major flaw I find is that JSON's grammar looks simple but has real corner cases which can have serious (sometimes legal and ethical) implications if not handled well. This is because JSON just defines the syntax or textual representation of the data. It doesn't define what type that data expects. It is entirely implementation-defined.

For e.g,

```json
{
  "age": 22,
  "price": 1.1
}
```

Different implementations can represent this data differently.

```
JSON                 Possible representation

22          →        int
22          →        int64
22          →        float64
1.1         →        float64
1.1         →        decimal

// yeah, someone can do this too!
1.1         →        string // and parse it later maybe?
```

JSON doesn't force specific types on the data. For small numbers, it doesn't matter much. But the same ambiguity that lets `22` or `1.1` become an `int` or a `float64` interchangeably is where real damage can occur. And `float64` itself can't represent every value accurately, since it is equal to n/2^m. So, numbers that aren't cleanly divisible by 2 end up rounded to the closest representable value instead of their exact one. That alone could be its own blog post, but, I digress. If you are interested in a detailed explanation for this and the many flaws of json, you can check out [this article](https://mcyoung.xyz/2024/12/10/json-sucks/).

Ambiguity like this doesn't feel like something I want to build a database around, especially a distributed one. A reasonable objection here would be: doesn't typed JSON (JSON Schema, TypeScript interfaces, a validation library) solve this? Sort of, but the typing lives outside the format, not inside it. A schema file is a promise this type of tooling makes about the bytes; it isn't enforced by the bytes themselves. Every service that receives a message has to independently choose to validate against it which brings back the same problem: validation becomes "implementation-defined," and an extra "dependency" the code has to rely on. There's also no structural versioning contract: two independently-valid schemas can disagree field by field, and the mismatch shows up as a bug deep inside application code instead of as a decode failure at the network boundary, which is where it should surface.

So the obvious choice turns out to be Protobuf, which solves the problems above. The same example above can be represented in protobuf as follows:

```protobuf
message Foo{
  optional int32 age = 1;
  optional double price = 2;
  // where 1 and 2 are field numbers and not their values
}
```

In Protobuf, types are enforced by the schema and therefore a field declared `int32` is an `int32` everywhere. Uniqueness is also guaranteed by the field numbers and not the field names like `age` and `price`, unlike JSON.

However, Protobuf does have its own pitfalls to look out for.

The most relevant one for this blog is: in proto3, basic fields like string, numeric, bytes, enum, etc. don't track presence by default, as [Protobuf's own documentation explains](https://protobuf.dev/programming-guides/field_presence/). The default value and an unused field become indistinguishable on the wire. Take the `age` field, for example, if a `Foo` message arrives with `age` unset, decoding it gives `age = 0`. But if a message arrives where `age` is explicitly set to `0`, decoding it gives the same result. There's no way to tell whether the field was left unset or deliberately set to `0`. This can cause subtle bugs later on and should be avoided, especially if MVCC becomes a thing in my database. The `optional` keyword solves this by telling the generated code to track the presence separately from the value, and the official documentation also recommends this approach.

There are many other such pitfalls, and if you'd like to read more: [Avoiding Common Protobuf Pitfalls with Buf](https://earthly.dev/blog/buf-protobuf/) and [Understanding Protobuf Compatibility](https://yokota.blog/2021/08/26/understanding-protobuf-compatibility/) are both worth reading.

So, even if Protobuf isn't perfect, its pitfalls can be contained and resolved using mechanisms it provides itself.

That said, one thing worth checking before committing to this: does the safety cost anything in performance? I benchmarked marshal/unmarshal on a representative message — protobuf came out ~2.3x faster to marshal, ~10.4x faster to unmarshal, and produced a wire payload ~2.13x smaller than the JSON equivalent. So this isn't safety-vs-speed; on this axis protobuf wins both.

![compare wireformat results](images/blogs/omni/compare_wireformat.png)

_Comparison Result_

> [!note] These are benchmarks on a single machine with a single message shape and shouldn't be treated as a substiture for measuring real concurrent load.

Thus, the wire format answers what the data looks like. It doesn't answer how it actually travels between processes and that is a different decision for the next post.
