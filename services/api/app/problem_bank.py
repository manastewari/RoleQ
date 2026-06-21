from copy import deepcopy

from .schemas import CodingProblemPublic, TestCasePublic


LANGUAGES = ["python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go"]


PROBLEMS: list[dict] = [
    {
        "id": "stable-signal-window",
        "title": "Stable Signal Window",
        "difficulty": "easy",
        "statement": (
            "A monitoring stream contains integer signal codes. Find the length of the longest contiguous "
            "window containing at most two distinct signal codes."
        ),
        "input_format": "First line: integer n. Second line: n space-separated signal codes.",
        "output_format": "Print one integer: the maximum valid window length.",
        "constraints": ["1 ≤ n ≤ 200000", "-10^9 ≤ signal[i] ≤ 10^9"],
        "examples": [
            {"input": "7\n1 2 1 2 3 2 2\n", "expected_output": "4\n", "explanation": "1 2 1 2"},
            {"input": "5\n8 8 8 8 8\n", "expected_output": "5\n", "explanation": "Only one signal code."},
        ],
        "hidden_tests": [
            {"input": "6\n1 2 3 2 2 3\n", "expected_output": "5\n"},
            {"input": "1\n42\n", "expected_output": "1\n"},
        ],
        "expected_complexity": "O(n) time and O(1) distinct-key space",
        "tags": ["arrays", "sliding-window", "hash-map"],
        "starter_code": {
            "python": "def longest_window(signals):\n    # TODO\n    return 0\n\nn = int(input())\nsignals = list(map(int, input().split()))\nprint(longest_window(signals))\n",
            "java": "import java.util.*;\npublic class Main {\n  static int longestWindow(int[] a) {\n    // TODO\n    return 0;\n  }\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int n = sc.nextInt(); int[] a = new int[n];\n    for (int i=0;i<n;i++) a[i]=sc.nextInt();\n    System.out.println(longestWindow(a));\n  }\n}\n",
            "javascript": "const fs=require('fs');\nconst v=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);\nconst n=v[0], a=v.slice(1,1+n);\nfunction longestWindow(a){\n  // TODO\n  return 0;\n}\nconsole.log(longestWindow(a));\n",
            "typescript": "import * as fs from 'fs';\nconst v=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);\nconst n=v[0], a=v.slice(1,1+n);\nfunction longestWindow(a:number[]):number {\n  // TODO\n  return 0;\n}\nconsole.log(longestWindow(a));\n",
            "c": "#include <stdio.h>\nint longest_window(int *a, int n) {\n  /* TODO */\n  return 0;\n}\nint main(){int n; scanf(\"%d\",&n); int a[200000]; for(int i=0;i<n;i++) scanf(\"%d\",&a[i]); printf(\"%d\\n\",longest_window(a,n));}\n",
            "cpp": "#include <bits/stdc++.h>\nusing namespace std;\nint longestWindow(const vector<int>& a){\n  // TODO\n  return 0;\n}\nint main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n;cin>>n;vector<int>a(n);for(int&x:a)cin>>x;cout<<longestWindow(a)<<'\\n';}\n",
            "csharp": "using System;\nusing System.Linq;\nclass Program {\n  static int LongestWindow(int[] a) {\n    // TODO\n    return 0;\n  }\n  static void Main(){int n=int.Parse(Console.ReadLine()!);var a=Console.ReadLine()!.Split().Select(int.Parse).ToArray();Console.WriteLine(LongestWindow(a));}\n}\n",
            "go": "package main\nimport \"fmt\"\nfunc longestWindow(a []int) int {\n  // TODO\n  return 0\n}\nfunc main(){var n int;fmt.Scan(&n);a:=make([]int,n);for i:=range a{fmt.Scan(&a[i])};fmt.Println(longestWindow(a))}\n",
        },
    },
    {
        "id": "dependency-release-order",
        "title": "Dependency Release Order",
        "difficulty": "medium",
        "statement": (
            "Services are numbered 1 through n. Each dependency pair a b means service a must be released "
            "before service b. Return the lexicographically smallest valid release order, or print IMPOSSIBLE "
            "when the dependency graph contains a cycle."
        ),
        "input_format": "First line: n m. Next m lines: a b.",
        "output_format": "Print the order separated by spaces, or IMPOSSIBLE.",
        "constraints": ["1 ≤ n,m ≤ 200000", "1 ≤ a,b ≤ n"],
        "examples": [
            {"input": "4 3\n1 2\n1 3\n3 4\n", "expected_output": "1 2 3 4\n"},
            {"input": "2 2\n1 2\n2 1\n", "expected_output": "IMPOSSIBLE\n"},
        ],
        "hidden_tests": [
            {"input": "5 4\n2 4\n1 4\n4 5\n1 3\n", "expected_output": "1 2 3 4 5\n"},
            {"input": "1 0\n", "expected_output": "1\n"},
        ],
        "expected_complexity": "O((n + m) log n) time and O(n + m) space",
        "tags": ["graphs", "topological-sort", "priority-queue"],
        "starter_code": {
            "python": "import heapq\n\ndef release_order(n, edges):\n    # TODO\n    return []\n\nn,m=map(int,input().split())\nedges=[tuple(map(int,input().split())) for _ in range(m)]\nans=release_order(n,edges)\nprint(' '.join(map(str,ans)) if ans else 'IMPOSSIBLE')\n",
            "java": "import java.util.*;\npublic class Main { public static void main(String[] args){Scanner s=new Scanner(System.in);int n=s.nextInt(),m=s.nextInt();for(int i=0;i<m;i++){s.nextInt();s.nextInt();}/* TODO */System.out.println(\"IMPOSSIBLE\");}}\n",
            "javascript": "const fs=require('fs');const v=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);/* TODO */console.log('IMPOSSIBLE');\n",
            "typescript": "import * as fs from 'fs';const v=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);/* TODO */console.log('IMPOSSIBLE');\n",
            "c": "#include <stdio.h>\nint main(){int n,m;scanf(\"%d%d\",&n,&m);/* TODO */puts(\"IMPOSSIBLE\");}\n",
            "cpp": "#include <bits/stdc++.h>\nusing namespace std;int main(){ios::sync_with_stdio(false);cin.tie(nullptr);int n,m;cin>>n>>m;/* TODO */cout<<\"IMPOSSIBLE\\n\";}\n",
            "csharp": "using System;class Program{static void Main(){var p=Console.ReadLine()!.Split();/* TODO */Console.WriteLine(\"IMPOSSIBLE\");}}\n",
            "go": "package main\nimport \"fmt\"\nfunc main(){var n,m int;fmt.Scan(&n,&m);_ = n;_ = m;/* TODO */fmt.Println(\"IMPOSSIBLE\")}\n",
        },
    },
    {
        "id": "compact-event-log",
        "title": "Compact Event Log",
        "difficulty": "medium",
        "statement": (
            "Compress a sequence of event names using run-length encoding. Consecutive equal names become "
            "name:count. Preserve order and join groups with one space."
        ),
        "input_format": "First line: n. Next n lines: one non-empty event name without spaces.",
        "output_format": "Print the compressed groups on one line.",
        "constraints": ["1 ≤ n ≤ 200000", "1 ≤ length(name) ≤ 40"],
        "examples": [
            {"input": "6\nSTART\nSTART\nPING\nPING\nPING\nEND\n", "expected_output": "START:2 PING:3 END:1\n"}
        ],
        "hidden_tests": [
            {"input": "4\nA\nB\nA\nA\n", "expected_output": "A:1 B:1 A:2\n"},
            {"input": "1\nONLY\n", "expected_output": "ONLY:1\n"},
        ],
        "expected_complexity": "O(n) time and O(n) output space",
        "tags": ["strings", "simulation"],
        "starter_code": {
            "python": "def compact(events):\n    # TODO\n    return ''\n\nn=int(input())\nevents=[input().strip() for _ in range(n)]\nprint(compact(events))\n",
            "java": "import java.util.*;public class Main{static String compact(List<String> e){/* TODO */return \"\";}public static void main(String[]a){Scanner s=new Scanner(System.in);int n=Integer.parseInt(s.nextLine());List<String>e=new ArrayList<>();for(int i=0;i<n;i++)e.add(s.nextLine());System.out.println(compact(e));}}\n",
            "javascript": "const x=require('fs').readFileSync(0,'utf8').trim().split(/\\r?\\n/);const e=x.slice(1);function compact(e){/* TODO */return '';}console.log(compact(e));\n",
            "typescript": "import * as fs from 'fs';const x=fs.readFileSync(0,'utf8').trim().split(/\\r?\\n/);const e=x.slice(1);function compact(e:string[]):string{/* TODO */return '';}console.log(compact(e));\n",
            "c": "#include <stdio.h>\n#include <string.h>\nint main(){int n;scanf(\"%d\",&n);/* TODO */return 0;}\n",
            "cpp": "#include <bits/stdc++.h>\nusing namespace std;int main(){int n;cin>>n;vector<string>e(n);for(auto&s:e)cin>>s;/* TODO */}\n",
            "csharp": "using System;using System.Collections.Generic;class Program{static void Main(){int n=int.Parse(Console.ReadLine()!);var e=new List<string>();for(int i=0;i<n;i++)e.Add(Console.ReadLine()!);/* TODO */}}\n",
            "go": "package main\nimport \"fmt\"\nfunc main(){var n int;fmt.Scan(&n);e:=make([]string,n);for i:=range e{fmt.Scan(&e[i])};/* TODO */}\n",
        },
    },
]


def get_problem(problem_id: str) -> dict:
    for problem in PROBLEMS:
        if problem["id"] == problem_id:
            return deepcopy(problem)
    raise KeyError(problem_id)


def public_problem(problem: dict) -> CodingProblemPublic:
    return CodingProblemPublic(
        id=problem["id"],
        title=problem["title"],
        difficulty=problem["difficulty"],
        statement=problem["statement"],
        input_format=problem["input_format"],
        output_format=problem["output_format"],
        constraints=problem["constraints"],
        examples=[TestCasePublic(**test) for test in problem["examples"]],
        expected_complexity=problem["expected_complexity"],
        starter_code=problem["starter_code"],
        tags=problem["tags"],
    )

