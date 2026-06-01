import sys


def parse_attendee_pipeline_args(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    opts = {
        "test": False,
        "force": False,
        "force_profile": False,
        "force_posts": False,
        "event_slug": None,
        "attendee": None,
        "limit": None,
    }
    for i, a in enumerate(args):
        if a == "--test":
            opts["test"] = True
        elif a == "--force":
            opts["force"] = True
        elif a == "--force-profile":
            opts["force_profile"] = True
        elif a == "--force-posts":
            opts["force_posts"] = True
        elif a == "--event" and i + 1 < len(args):
            opts["event_slug"] = args[i + 1]
        elif a == "--attendee" and i + 1 < len(args):
            opts["attendee"] = args[i + 1]
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
        opts["force_profile"] = True
        opts["force_posts"] = True
    return opts
