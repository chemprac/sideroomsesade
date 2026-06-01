import sys


def parse_pipeline_args(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    opts = {
        "test": False,
        "force": False,
        "force_crawl": False,
        "force_summaries": False,
        "event_slug": None,
        "company": None,
        "limit": None,
    }
    for i, a in enumerate(args):
        if a == "--test":
            opts["test"] = True
        elif a == "--force":
            opts["force"] = True
        elif a == "--force-crawl":
            opts["force_crawl"] = True
        elif a == "--force-summaries":
            opts["force_summaries"] = True
        elif a == "--event" and i + 1 < len(args):
            opts["event_slug"] = args[i + 1]
        elif a == "--company" and i + 1 < len(args):
            opts["company"] = args[i + 1]
        elif a == "--limit" and i + 1 < len(args):
            try:
                opts["limit"] = int(args[i + 1])
            except ValueError:
                print(f"ERROR: --limit must be an integer, got {args[i + 1]!r}")
                sys.exit(1)
    if not opts["event_slug"]:
        print("ERROR: --event is required")
        sys.exit(1)
    if opts["force"]:
        opts["force_crawl"] = True
        opts["force_summaries"] = True
    return opts
